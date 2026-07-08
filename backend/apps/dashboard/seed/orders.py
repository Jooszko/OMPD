from orders.models import DailyOrder, StandingOrder

STANDING_ORDER_EXTRA_CLIENT_COUNT = 10
DAILY_ORDER_STATUSES_PAST = ['delivered', 'delivered', 'delivered', 'delivered', 'cancelled']
DAILY_ORDER_STATUSES_TODAY = ['planned', 'in_production', 'in_delivery', 'delivered']
AD_HOC_ORDERS_PER_TRIGGER_DAY = 3


def create_standing_orders(clients, products):
    product_list = list(products.values())
    standing_orders = []

    def make_one(client, offset):
        product = product_list[(client.client_id + offset) % len(product_list)]
        day_of_week = (client.client_id + offset) % 7
        quantity = 10 + ((client.client_id * (offset + 1)) % 40)
        standing_order, _ = StandingOrder.objects.get_or_create(
            client=client,
            product=product,
            day_of_week=day_of_week,
            defaults={
                'quantity': quantity,
                'price_at_sale': product.base_price,
                'is_active': True,
            },
        )
        standing_orders.append(standing_order)

    for client in clients:
        make_one(client, 0)
    for client in clients[:STANDING_ORDER_EXTRA_CLIENT_COUNT]:
        make_one(client, 1)

    return standing_orders


def create_daily_orders(clients, products, standing_orders, date_range):
    product_list = list(products.values())
    today = date_range[-1]
    created_count = 0

    standing_by_day = {}
    for standing_order in standing_orders:
        standing_by_day.setdefault(standing_order.day_of_week, []).append(standing_order)

    for order_date in date_range:
        is_today = order_date == today
        weekday = order_date.weekday()

        for standing_order in standing_by_day.get(weekday, []):
            if not standing_order.is_active:
                continue
            variance_steps = ((standing_order.client_id + order_date.toordinal()) % 5) - 2
            variance = 1 + (variance_steps * 0.1)
            quantity = max(1, int(standing_order.quantity * variance))
            if is_today:
                status = DAILY_ORDER_STATUSES_TODAY[
                    (standing_order.client_id + order_date.toordinal()) % len(DAILY_ORDER_STATUSES_TODAY)
                ]
            else:
                status = DAILY_ORDER_STATUSES_PAST[
                    (standing_order.client_id + order_date.toordinal()) % len(DAILY_ORDER_STATUSES_PAST)
                ]
            _, created = DailyOrder.objects.get_or_create(
                client=standing_order.client,
                product=standing_order.product,
                order_date=order_date,
                defaults={
                    'quantity': quantity,
                    'price_at_sale': standing_order.price_at_sale,
                    'status': status,
                },
            )
            if created:
                created_count += 1

        if order_date.toordinal() % 5 == 0:
            for i in range(AD_HOC_ORDERS_PER_TRIGGER_DAY):
                client = clients[(order_date.toordinal() + i) % len(clients)]
                product = product_list[(order_date.toordinal() + i * 3) % len(product_list)]
                quantity = 5 + (i * 4)
                status = 'planned' if is_today else 'delivered'
                _, created = DailyOrder.objects.get_or_create(
                    client=client,
                    product=product,
                    order_date=order_date,
                    defaults={
                        'quantity': quantity,
                        'price_at_sale': product.base_price,
                        'status': status,
                    },
                )
                if created:
                    created_count += 1

    return created_count
