from datetime import timedelta
from decimal import Decimal

from django.db.models import DecimalField, ExpressionWrapper, F, Sum
from django.utils import timezone

from audit.models import AuditEntry
from finance.calculations import daily_results
from finance.models import DailyFinancialReport
from finance.overview import money
from orders.models import DailyOrder, StandingOrder
from production.models import ProductionBatch, ProductionPlan
from production.services.planning import current_production_date, delivery_date_for, product_demand
from products.models import IngredientStock, Recipe

LANE_STATUSES = ('planned', 'in_production', 'in_delivery', 'delivered', 'failed')
FAILED_DAYS = 7
TREND_DAYS = 8
RECENT_CHANGES = 3


def _iso(value):
    return timezone.localtime(value).isoformat() if value else None


def _route_name(order):
    route = order.assigned_route or order.client.route
    return route.route_name if route else ''


def today_orders(today):
    orders = list(
        DailyOrder.objects
        .filter(order_date=today, status__in=LANE_STATUSES)
        .select_related('client__route', 'product', 'assigned_route')
        .order_by('client__name', 'product__name')
    )
    by_status = {status: 0 for status in LANE_STATUSES}
    for order in orders:
        by_status[order.status] += 1
    return {
        'total': len(orders),
        'clients': len({order.client_id for order in orders}),
        'routes': len({_route_name(order) for order in orders if _route_name(order)}),
        'pieces': sum(order.quantity for order in orders if order.status != 'failed'),
        'by_status': by_status,
        'items': [
            {
                'order_id': order.pk,
                'client_id': order.client_id,
                'client_name': order.client.name,
                'product_name': order.product.name,
                'quantity': order.quantity,
                'status': order.status,
                'route_name': _route_name(order),
                'delivered_at': _iso(order.delivered_at),
            }
            for order in orders
        ],
    }


def _ingredients_for(delivery_date):
    rows = (
        Recipe.objects
        .filter(
            product__daily_orders__order_date=delivery_date,
            product__daily_orders__status__in=('planned', 'in_production', 'in_delivery', 'delivered'),
        )
        .values('ingredient__name', 'ingredient__unit')
        .annotate(total=Sum(ExpressionWrapper(
            F('amount') * F('product__daily_orders__quantity'),
            output_field=DecimalField(max_digits=12, decimal_places=3),
        )))
        .order_by('-total', 'ingredient__name')
    )
    return [
        {'name': row['ingredient__name'], 'unit': row['ingredient__unit'], 'amount': str(row['total'])}
        for row in rows
    ]


def production_shift(now=None):
    production_date = current_production_date(now)
    delivery_date = delivery_date_for(production_date)
    plan = ProductionPlan.objects.filter(delivery_date=delivery_date).first()
    batches = list(
        ProductionBatch.objects.filter(plan=plan).select_related('dough', 'mixer').order_by('dough__name', 'sequence')
    ) if plan else []
    stages = {stage: 0 for stage in ProductionBatch.STAGE_ORDER}
    for batch in batches:
        stages[batch.stage] += 1

    demand = product_demand(delivery_date)
    orders = DailyOrder.objects.filter(order_date=delivery_date).exclude(status__in=DailyOrder.NON_REVENUE_STATUSES)
    standing = StandingOrder.objects.filter(is_active=True, day_of_week=delivery_date.weekday())
    products = (
        orders.values('product__name').annotate(total=Sum('quantity')).order_by('-total', 'product__name')
    )
    return {
        'production_date': str(production_date),
        'delivery_date': str(delivery_date),
        'has_plan': plan is not None,
        'orders': orders.count(),
        'clients': orders.values('client').distinct().count(),
        'pieces': sum(demand.values()),
        'standing_clients': standing.values('client').distinct().count(),
        'standing_pieces': standing.aggregate(total=Sum('quantity'))['total'] or 0,
        'stages': stages,
        'batches': [
            {
                'batch_id': batch.pk,
                'dough_name': batch.dough.name,
                'mixer_name': batch.mixer.name if batch.mixer else '',
                'sequence': batch.sequence,
                'batch_count': batch.batch_count,
                'stage': batch.stage,
            }
            for batch in batches
        ],
        'products': [{'name': row['product__name'], 'quantity': row['total']} for row in products],
        'ingredients': _ingredients_for(delivery_date),
    }
def _stop_status(statuses):
    if all(status == 'delivered' for status in statuses):
        return 'delivered'
    if 'failed' in statuses:
        return 'failed'
    if 'in_delivery' in statuses:
        return 'in_delivery'
    return 'waiting'


def _route_state(stops):
    finished = [stop for stop in stops if stop['status'] in ('delivered', 'failed')]
    if len(finished) == len(stops):
        return 'done'
    if finished or any(stop['status'] == 'in_delivery' for stop in stops):
        return 'on_road'
    return 'waiting'


def routes_today(today):
    orders = (
        DailyOrder.objects
        .filter(order_date=today, status__in=LANE_STATUSES)
        .select_related('client__route__driver', 'assigned_route__driver')
        .order_by('client__name')
    )
    routes = {}
    for order in orders:
        route = order.assigned_route or order.client.route
        entry = routes.setdefault(route.pk, {'route': route, 'clients': {}})
        stop = entry['clients'].setdefault(order.client_id, {'client': order.client, 'statuses': [], 'delivered_at': None})
        stop['statuses'].append(order.status)
        if order.delivered_at and (stop['delivered_at'] is None or order.delivered_at > stop['delivered_at']):
            stop['delivered_at'] = order.delivered_at

    result = []
    for entry in sorted(routes.values(), key=lambda item: item['route'].route_name):
        route = entry['route']
        stops = [
            {
                'client_id': client_id,
                'client_name': stop['client'].name,
                'latitude': float(stop['client'].latitude) if stop['client'].latitude is not None else None,
                'longitude': float(stop['client'].longitude) if stop['client'].longitude is not None else None,
                'status': _stop_status(stop['statuses']),
                'delivered_at': _iso(stop['delivered_at']),
            }
            for client_id, stop in entry['clients'].items()
        ]
        delivered = [stop for stop in stops if stop['status'] == 'delivered' and stop['delivered_at']]
        last = max(delivered, key=lambda stop: stop['delivered_at']) if delivered else None
        result.append({
            'route_id': route.pk,
            'route_name': route.route_name,
            'driver_name': route.driver.full_name if route.driver else '',
            'state': _route_state(stops),
            'delivered_stops': sum(1 for stop in stops if stop['status'] == 'delivered'),
            'total_stops': len(stops),
            'last_delivery': {'client_name': last['client_name'], 'delivered_at': last['delivered_at']} if last else None,
            'stops': stops,
        })
    return result

def low_stock():
    rows = (
        IngredientStock.objects
        .filter(current_stock__lt=F('min_stock_level'))
        .select_related('ingredient')
        .order_by('ingredient__name')
    )
    return [
        {
            'name': row.ingredient.name,
            'unit': row.ingredient.unit,
            'current': str(row.current_stock),
            'minimum': str(row.min_stock_level),
        }
        for row in rows
    ]


def failed_deliveries(today):
    orders = (
        DailyOrder.objects
        .filter(status='failed', order_date__gte=today - timedelta(days=FAILED_DAYS - 1), order_date__lte=today)
        .select_related('client')
        .order_by('-order_date', 'client__name')
    )
    return [
        {'order_id': order.pk, 'client_name': order.client.name, 'date': str(order.order_date)}
        for order in orders
    ]


def build_alerts(today, shift, is_admin):
    alerts = []
    if is_admin:
        failed = failed_deliveries(today)
        if failed:
            alerts.append({'kind': 'failed_deliveries', 'severity': 'critical', 'items': failed})
    stock = low_stock()
    if stock:
        alerts.append({'kind': 'low_stock', 'severity': 'critical', 'items': stock})
    if not shift['has_plan'] and (shift['pieces'] or shift['standing_pieces']):
        alerts.append({'kind': 'missing_plan', 'severity': 'warning', 'items': [{'date': shift['delivery_date']}]})
    if is_admin:
        yesterday = today - timedelta(days=1)
        if not DailyFinancialReport.objects.filter(report_date=yesterday, is_finalized=True).exists():
            alerts.append({'kind': 'day_not_closed', 'severity': 'warning', 'items': [{'date': str(yesterday)}]})
    return alerts


def finance_today(today):
    days = daily_results(today - timedelta(days=TREND_DAYS - 1), today)
    current = days[-1]
    previous = [day['revenue'] for day in days[:-1]]
    average = sum(previous, Decimal('0')) / len(previous)
    return {
        'revenue': money(current['revenue']),
        'cogs': money(current['cogs']),
        'net_profit': money(current['net_profit']),
        'average_revenue': money(average),
        'trend': [{'date': str(day['date']), 'revenue': money(day['revenue'])} for day in days],
    }


def recent_changes():
    return [
        {
            'entry_id': entry.pk,
            'description': entry.description,
            'actor_name': entry.actor_name,
            'created_at': _iso(entry.created_at),
        }
        for entry in AuditEntry.objects.order_by('-created_at', '-pk')[:RECENT_CHANGES]
    ]


def build_home(user, today, now=None):
    is_admin = user.role == 'admin'
    shift = production_shift(now)
    return {
        'today': str(today),
        'viewer': {'full_name': user.full_name or user.username, 'role': user.role},
        'orders': today_orders(today),
        'routes': routes_today(today) if is_admin else [],
        'production': shift,
        'alerts': build_alerts(today, shift, is_admin),
        'finance': finance_today(today) if is_admin else None,
        'recent_changes': recent_changes() if is_admin else [],
    }