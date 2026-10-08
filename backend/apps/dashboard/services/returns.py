from django.db.models import Max

from orders.models import DailyOrder


def last_delivery_items(client_ids, before_date):
    """Products each client received in their last delivery before `before_date`.

    Returns {client_id: {'source_date': date, 'items': [
        {'product_id', 'product_name', 'quantity', 'unit_price'}, ...]}}.
    Clients without any earlier delivery are left out.
    """
    delivered = DailyOrder.objects.filter(client_id__in=client_ids, status='delivered')
    last_dates = dict(
        delivered
        .filter(order_date__lt=before_date)
        .values('client_id')
        .annotate(last_date=Max('order_date'))
        .values_list('client_id', 'last_date')
    )
    if not last_dates:
        return {}

    orders = (
        delivered
        .filter(client_id__in=last_dates.keys(), order_date__in=set(last_dates.values()))
        .select_related('product')
        .order_by('product__name', 'do_id')
    )
    result = {}
    for order in orders:
        if order.order_date != last_dates[order.client_id]:
            continue
        entry = result.setdefault(order.client_id, {'source_date': order.order_date, 'items': {}})
        item = entry['items'].setdefault(order.product_id, {
            'product_id': order.product_id,
            'product_name': order.product.name,
            'quantity': 0,
            'unit_price': order.price_at_sale,
        })
        item['quantity'] += order.quantity

    return {
        client_id: {'source_date': entry['source_date'], 'items': list(entry['items'].values())}
        for client_id, entry in result.items()
    }