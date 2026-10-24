from decimal import Decimal

from django.utils import timezone

from common.holidays import is_holiday
from dashboard.services.optimize import optimize_stop_order
from production.models import ProductionPlan
from production.services.planning import build_plan_preview, order_changes

from .models import DailyOrder, StandingOrder
from .standing import standing_orders_due, summarize_by_client

LOCKED_STATUSES = ('in_delivery', 'delivered', 'failed')
STOP_STATUS_PRIORITY = ('failed', 'in_delivery', 'in_production', 'planned', 'delivered')


def stop_status(statuses):
    active = statuses - {'cancelled'}
    if not active:
        return 'cancelled'
    return next(status for status in STOP_STATUS_PRIORITY if status in active)

def _point(client):
    if client.latitude is None or client.longitude is None:
        return None
    return float(client.latitude), float(client.longitude)

def _money(amount):
    return float(round(amount, 2))


def _plan_info(order_date):
    plan = ProductionPlan.objects.filter(delivery_date=order_date).first()
    if plan is None:
        return None
    return {
        'production_date': str(plan.production_date),
        'created_at': plan.created_at.isoformat(),
        'changes': order_changes(plan, build_plan_preview(order_date)),
    }


def _standing_due(order_date, is_past):
    if is_past:
        return None
    clients = summarize_by_client(standing_orders_due(order_date))
    return {'clients': len(clients), 'items': sum(entry['items'] for entry in clients)}

def _driving_order(stops):
    located = [stop for stop in stops if stop['point'] is not None]
    order = optimize_stop_order([stop['point'] for stop in located]) if located else []
    return [located[index]['client_id'] for index in order] + [
        stop['client_id'] for stop in stops if stop['point'] is None
    ]

def build_day(order_date):
    today = timezone.localdate()
    is_past = order_date < today
    orders = (
        DailyOrder.objects
        .filter(order_date=order_date)
        .select_related('client__route__driver', 'product', 'assigned_route__driver')
        .order_by('client__name', 'product__name')
    )
    standing_clients = set(
        StandingOrder.objects
        .filter(day_of_week=order_date.weekday(), is_active=True)
        .values_list('client_id', flat=True)
    )

    stops = {}
    products = {}
    for order in orders:
        route = order.assigned_route or order.client.route
        stop = stops.setdefault(order.client_id, {
            'id': f'{order_date}-{order.client_id}',
            'client_id': order.client_id,
            'client_name': order.client.name,
            'address': order.client.address,
            'phone': order.client.phone,
            'point': _point(order.client),
            'is_standing': order.client_id in standing_clients,
            'route': route,
            'statuses': set(),
            'total_quantity': 0,
            'total_amount': Decimal('0'),
            'items': [],
        })
        stop['statuses'].add(order.status)
        stop['items'].append({
            'product_id': order.product_id,
            'product_name': order.product.name,
            'qty': order.quantity,
            'price': _money(order.price_at_sale),
            'status': order.status,
        })
        if order.status != 'cancelled':
            stop['total_quantity'] += order.quantity
            stop['total_amount'] += order.quantity * order.price_at_sale
            entry = products.setdefault(order.product_id, {
                'product_id': order.product_id, 'product_name': order.product.name, 'quantity': 0,
            })
            entry['quantity'] += order.quantity

    routes = {}
    by_status = {code: 0 for code, _ in DailyOrder.STATUS_CHOICES}
    summary = {'stops': 0, 'pieces': 0, 'value': Decimal('0')}
    for stop in stops.values():
        route = stop.pop('route')
        statuses = stop.pop('statuses')
        stop['status'] = stop_status(statuses)
        stop['locked'] = is_past or bool(statuses & set(LOCKED_STATUSES))
        by_status[stop['status']] += 1
        if stop['status'] != 'cancelled':
            summary['stops'] += 1
            summary['pieces'] += stop['total_quantity']
            summary['value'] += stop['total_amount']
        group = routes.setdefault(route.route_id if route else None, {
            'route_id': route.route_id if route else None,
            'route_name': route.route_name if route else 'Bez trasy',
            'driver_name': route.driver.full_name if route and route.driver else None,
            'total_quantity': 0,
            'total_amount': Decimal('0'),
            'stops': [],
        })
        group['total_quantity'] += stop['total_quantity']
        group['total_amount'] += stop['total_amount']
        stop['total_amount'] = _money(stop['total_amount'])
        group['stops'].append(stop)

    route_list = sorted(routes.values(), key=lambda group: (group['route_id'] is None, group['route_name']))
    for group in route_list:
        group['total_amount'] = _money(group['total_amount'])
        group['driving_order'] = _driving_order(group['stops'])
        for stop in group['stops']:
            del stop['point']

    return {
        'date': str(order_date),
        'is_today': order_date == today,
        'is_past': is_past,
        'is_holiday': is_holiday(order_date),
        'summary': {**summary, 'value': _money(summary['value']), 'by_status': by_status},
        'products': sorted(products.values(), key=lambda row: (-row['quantity'], row['product_name'])),
        'routes': route_list,
        'standing_due': _standing_due(order_date, is_past),
        'plan': _plan_info(order_date),
    }