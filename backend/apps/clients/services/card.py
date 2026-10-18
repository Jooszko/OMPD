from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

from orders.models import DailyOrder, ProductReturn

WINDOW_DAYS = 30
RECENT_DELIVERIES = 6
CENT = Decimal('0.01')

STATUS_PRIORITY = ['delivered', 'failed', 'in_delivery', 'in_production', 'planned', 'cancelled']
STATUS_LABELS = dict(DailyOrder.STATUS_CHOICES)


def _money(value):
    return str(value.quantize(CENT))


def _day_status(statuses):
    return next(status for status in STATUS_PRIORITY if status in statuses)


def _delivery_days(orders):
    days = defaultdict(lambda: {'value': Decimal('0'), 'statuses': set()})
    for order in orders:
        day = days[order.order_date]
        day['value'] += order.quantity * order.price_at_sale
        day['statuses'].add(order.status)
    return days


def client_card(client, today):
    start = today - timedelta(days=WINDOW_DAYS - 1)

    standing = [
        {
            'so_id': order.so_id,
            'day_of_week': order.day_of_week,
            'product_name': order.product.name,
            'quantity': order.quantity,
            'price': _money(order.price_at_sale),
        }
        for order in client.standing_orders.filter(is_active=True)
        .select_related('product')
        .order_by('day_of_week', 'product__name')
    ]

    window_orders = list(client.daily_orders.filter(order_date__range=(start, today)))
    sales = sum(
        (o.quantity * o.price_at_sale for o in window_orders if o.status not in DailyOrder.NON_REVENUE_STATUSES),
        Decimal('0'),
    )
    window_days = _delivery_days(window_orders)
    planned_days = [day for day in window_days.values() if day['statuses'] != {'cancelled'}]
    delivered_days = [day for day in planned_days if _day_status(day['statuses']) == 'delivered']
    returns = sum(
        (r.quantity * r.unit_price for r in ProductReturn.objects.filter(client=client, return_date__range=(start, today))),
        Decimal('0'),
    )

    recent_dates = list(
        client.daily_orders.values_list('order_date', flat=True).distinct().order_by('-order_date')[:RECENT_DELIVERIES]
    )
    recent_days = _delivery_days(client.daily_orders.filter(order_date__in=recent_dates))
    recent = []
    for day in recent_dates:
        status = _day_status(recent_days[day]['statuses'])
        recent.append({
            'date': day.isoformat(),
            'value': _money(recent_days[day]['value']),
            'status': status,
            'status_label': STATUS_LABELS[status],
        })

    return {
        'standing_orders': standing,
        'last_30_days': {
            'sales': _money(sales),
            'delivered_days': len(delivered_days),
            'planned_days': len(planned_days),
            'returns': _money(returns),
        },
        'recent_deliveries': recent,
    }