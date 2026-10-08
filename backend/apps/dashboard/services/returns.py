from django.db.models import Max

from orders.models import DailyOrder, ProductReturn


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



def returns_overview(client_ids, return_date):
    """Last delivery of each client merged with returns already recorded on `return_date`.

    Returns {client_id: {'source_date': str, 'items': [
        {'product_id', 'product_name', 'delivered_quantity', 'returned_quantity', 'unit_price'}, ...]}}.
    """
    overview = {}
    for client_id, entry in last_delivery_items(client_ids, return_date).items():
        overview[client_id] = {
            'source_date': entry['source_date'],
            'items': {
                item['product_id']: {
                    'product_id': item['product_id'],
                    'product_name': item['product_name'],
                    'delivered_quantity': item['quantity'],
                    'returned_quantity': 0,
                    'unit_price': item['unit_price'],
                }
                for item in entry['items']
            },
        }

    recorded = ProductReturn.objects.filter(client_id__in=client_ids, return_date=return_date).select_related('product')
    for product_return in recorded:
        entry = overview.setdefault(
            product_return.client_id, {'source_date': product_return.source_date, 'items': {}}
        )
        item = entry['items'].setdefault(product_return.product_id, {
            'product_id': product_return.product_id,
            'product_name': product_return.product.name,
            'delivered_quantity': product_return.quantity,
        })
        item['returned_quantity'] = product_return.quantity
        item['unit_price'] = product_return.unit_price

    return {
        client_id: {
            'source_date': str(entry['source_date']),
            'items': [{**item, 'unit_price': str(item['unit_price'])} for item in entry['items'].values()],
        }
        for client_id, entry in overview.items()
    }