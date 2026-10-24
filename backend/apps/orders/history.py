from decimal import Decimal
from math import ceil

from django.db.models import DecimalField, ExpressionWrapper, F, Sum

from .day import _money, stop_status
from .models import DailyOrder

PAGE_SIZE = 25
OPEN_STATUSES = ('planned', 'in_production', 'in_delivery')
HISTORY_STATUSES = ('delivered', 'failed', 'cancelled', 'open')


def history_page(date_from, date_to, query='', status='', page=1):
    orders = DailyOrder.objects.filter(order_date__range=(date_from, date_to))
    if query:
        orders = orders.filter(client__name__icontains=query)
    if status == 'open':
        orders = orders.filter(status__in=OPEN_STATUSES)
    elif status:
        orders = orders.filter(status=status)

    stops = (
        orders
        .values('order_date', 'client_id', 'client__name')
        .distinct()
        .order_by('-order_date', 'client__name')
    )
    count = stops.count()
    pages = max(1, ceil(count / PAGE_SIZE))
    page = min(max(page, 1), pages)
    keys = [(row['order_date'], row['client_id']) for row in stops[(page - 1) * PAGE_SIZE:page * PAGE_SIZE]]

    lines = (
        DailyOrder.objects
        .filter(order_date__in={day for day, _ in keys}, client_id__in={client for _, client in keys})
        .select_related('client', 'product')
        .order_by('product__name')
    )
    results = {key: None for key in keys}
    for order in lines:
        key = (order.order_date, order.client_id)
        if key not in results:
            continue
        stop = results[key] or {
            'id': f'{order.order_date}-{order.client_id}',
            'date': str(order.order_date),
            'client_id': order.client_id,
            'client_name': order.client.name,
            'address': order.client.address,
            'statuses': set(),
            'total_quantity': 0,
            'total_amount': Decimal('0'),
            'items': [],
        }
        results[key] = stop
        stop['statuses'].add(order.status)
        stop['items'].append({
            'product_id': order.product_id,
            'product_name': order.product.name,
            'qty': order.quantity,
            'price': _money(order.price_at_sale),
            'status': order.status,
        })
        if order.status not in DailyOrder.NON_REVENUE_STATUSES:
            stop['total_quantity'] += order.quantity
            stop['total_amount'] += order.quantity * order.price_at_sale

    for stop in results.values():
        stop['status'] = stop_status(stop.pop('statuses'))
        stop['total_amount'] = _money(stop['total_amount'])

    totals = orders.exclude(status__in=DailyOrder.NON_REVENUE_STATUSES).aggregate(
        pieces=Sum('quantity'),
        value=Sum(ExpressionWrapper(F('quantity') * F('price_at_sale'), output_field=DecimalField(max_digits=14, decimal_places=2))),
    )
    return {
        'date_from': str(date_from),
        'date_to': str(date_to),
        'page': page,
        'pages': pages,
        'count': count,
        'summary': {'stops': count, 'pieces': totals['pieces'] or 0, 'value': _money(totals['value'] or Decimal('0'))},
        'results': list(results.values()),
    }