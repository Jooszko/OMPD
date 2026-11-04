from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone

from clients.models import Client
from orders.models import DailyOrder, ProductReturn, StandingOrder
from common.holidays import is_holiday

EVERY_DAY = (0, 1, 2, 3, 4, 5, 6)
MON_TO_SAT = (0, 1, 2, 3, 4, 5)
MON_TO_FRI = (0, 1, 2, 3, 4)

CLIENT_PROFILES = [
    ('Sklep Spożywczy', MON_TO_SAT, [
        ('Chleb pszenny 500g', 30), ('Chleb razowy 500g', 12), ('Bułka pszenna', 80), ('Bułka grahamka', 25),
    ]),
    ('Piekarnia', MON_TO_SAT, [
        ('Chleb na zakwasie', 20), ('Chleb wiejski 750g', 15), ('Chałka z rodzynkami', 6), ('Bułka z serem', 20),
    ]),
    ('Restauracja', EVERY_DAY, [('Bagietka francuska', 20), ('Bułka mleczna', 40)]),
    ('Kawiarnia', EVERY_DAY, [
        ('Drożdżówka cynamonowa', 20), ('Rogal maślany', 15), ('Drożdżówka z serem', 10),
        ('Pączek z nadzieniem różanym', 10),
    ]),
    ('Stołówka', MON_TO_FRI, [('Chleb pszenny 500g', 25), ('Bułka pszenna', 120)]),
    ('Hotel', EVERY_DAY, [
        ('Bułka pszenna', 60), ('Rogal maślany', 30), ('Bułka mleczna', 20), ('Chleb na zakwasie', 6),
    ]),
    ('Bar Mleczny', MON_TO_SAT, [('Chleb pszenny 500g', 20), ('Bułka pszenna', 50), ('Drożdżówka z serem', 15)]),
    ('Delikatesy', MON_TO_SAT, [
        ('Chleb na zakwasie', 12), ('Chleb słonecznikowy', 10), ('Bagietka francuska', 15), ('Chałka z rodzynkami', 5),
    ]),
    ('Sklep Osiedlowy', MON_TO_SAT, [
        ('Chleb pszenny 500g', 20), ('Bułka pszenna', 60), ('Drożdżówka z makiem', 15),
        ('Pączek z nadzieniem różanym', 15),
    ]),
    ('Cukiernia', MON_TO_SAT, [
        ('Pączek z nadzieniem różanym', 30), ('Drożdżówka z serem', 20), ('Drożdżówka z makiem', 12),
    ]),
]
CLIENT_SIZES = [1.0, 0.7, 1.3, 0.9, 1.5, 0.8]

WEEKDAY_FACTORS = [0.9, 1.0, 1.0, 1.05, 1.15, 1.3, 1.0]
HOLIDAY_EVE_FACTOR = 1.4
SUMMER_MONTHS = (7, 8)
SUMMER_FACTOR = 1.4
TOURIST_TOWNS = ('Wisła', 'Ustroń', 'Brenna')

DAILY_ORDER_STATUSES_PAST = ['delivered'] * 30 + ['failed', 'cancelled']
DAILY_ORDER_STATUSES_TODAY = ['planned', 'in_production', 'in_delivery', 'delivered']
OPEN_STATUSES = ['planned', 'in_production', 'in_delivery']
AD_HOC_ORDERS_PER_TRIGGER_DAY = 3

SEED_TIMEZONE = ZoneInfo('Europe/Warsaw')
SEED_ROUTE_START = time(6, 30)
SEED_ROUTE_SPAN_MINUTES = 300
SEED_FAILURE_REASONS = ['closed', 'no_access', 'refused', 'other']
SEED_FAILURE_NOTES = {
    'closed': ['Zamknięte, brak informacji na drzwiach.', 'Kartka na drzwiach: inwentaryzacja do 10:00.'],
    'no_access': ['Wjazd na zaplecze zastawiony przez inną dostawę.', 'Remont drogi, objazd niemożliwy przed 9:00.'],
    'refused': ['Kierownik odmówił – zostało dużo towaru z wczoraj.', 'Pracownik nie chciał podpisać dokumentu WZ.'],
    'other': ['Awaria auta na trasie, dostawa przepadła.', 'Pomyłka w załadunku – brak towaru dla klienta.'],
}
SEED_DELIVERY_NOTES = [
    'Towar zostawiony na zapleczu, klucz u ochrony.',
    'Odebrała p. Ania, wszystko się zgadza.',
    'Dostawa tylnym wejściem – front w remoncie.',
    'Klient prosi w soboty o dostawę przed 7:00.',
    'Skrzynki zwrotne zabrane.',
]
DELIVERY_NOTE_EVERY = 9

RETURNING_CLIENTS = ('Sklep Spożywczy', 'Sklep Osiedlowy', 'Delikatesy', 'Piekarnia', 'Cukiernia')
RETURNED_CATEGORIES = ('buns',)
RETURN_EVERY = 5



def seed_event_time(order_date, client_id):
    minutes = (client_id * 37 + order_date.toordinal()) % SEED_ROUTE_SPAN_MINUTES
    moment = datetime.combine(order_date, SEED_ROUTE_START, tzinfo=SEED_TIMEZONE) + timedelta(minutes=minutes)
    return min(moment, timezone.now())


def seed_delivery_fields(status, order_date, client_id):
    seed = client_id + order_date.toordinal()
    if status == 'delivered':
        fields = {'delivered_at': seed_event_time(order_date, client_id)}
        if seed % DELIVERY_NOTE_EVERY == 0:
            fields['delivery_note'] = SEED_DELIVERY_NOTES[seed // DELIVERY_NOTE_EVERY % len(SEED_DELIVERY_NOTES)]
        return fields
    if status == 'failed':
        reason = SEED_FAILURE_REASONS[(client_id + order_date.month) % len(SEED_FAILURE_REASONS)]
        notes = SEED_FAILURE_NOTES[reason]
        return {
            'failure_reason': reason,
            'failure_note': notes[order_date.toordinal() % len(notes)],
            'failed_at': seed_event_time(order_date, client_id),
        }
    return {}


def client_profile(client):
    return next((p for p in CLIENT_PROFILES if client.name.startswith(p[0])), CLIENT_PROFILES[0])


def delivers_on(client, order_date):
    if is_holiday(order_date):
        return False
    return not (client.name.startswith('Stołówka') and order_date.month in SUMMER_MONTHS)


def demand_factor(client, order_date):
    factor = WEEKDAY_FACTORS[order_date.weekday()]
    if is_holiday(order_date + timedelta(days=1)):
        factor *= HOLIDAY_EVE_FACTOR
    if order_date.month in SUMMER_MONTHS and client.address.endswith(TOURIST_TOWNS):
        factor *= SUMMER_FACTOR
    return factor


def day_status(client_id, order_date, today):
    if order_date > today:
        return 'planned'
    statuses = DAILY_ORDER_STATUSES_TODAY if order_date == today else DAILY_ORDER_STATUSES_PAST
    return statuses[(client_id + order_date.toordinal()) % len(statuses)]


def create_standing_orders(clients, products):
    standing_orders = []
    for index, client in enumerate(clients):
        if not client.is_active:
            continue
        _, days, basket = client_profile(client)
        size = CLIENT_SIZES[index % len(CLIENT_SIZES)]
        for product_name, quantity in basket:
            product = products[product_name]
            for day in days:
                standing_order, _ = StandingOrder.objects.get_or_create(
                    client=client,
                    product=product,
                    day_of_week=day,
                    defaults={
                        'quantity': max(1, round(quantity * size)),
                        'price_at_sale': product.base_price,
                        'is_active': True,
                    },
                )
                standing_orders.append(standing_order)
    return standing_orders


def create_daily_orders(clients, products, standing_orders, date_range, today=None):
    product_list = list(products.values())
    today = today or date_range[-1]
    clients_by_id = Client.objects.select_related('route__driver').in_bulk([c.client_id for c in clients])
    products_by_id = {product.product_id: product for product in product_list}
    active_ids = [c.client_id for c in clients if c.is_active]
    taken = set(
        DailyOrder.objects
        .filter(order_date__range=(date_range[0], date_range[-1]))
        .values_list('client_id', 'product_id', 'order_date')
    )
    new_orders = []

    def add(client, product, order_date, quantity, price, status):
        key = (client.client_id, product.product_id, order_date)
        if key in taken:
            return
        taken.add(key)
        new_orders.append(DailyOrder(
            client=client,
            product=product,
            order_date=order_date,
            quantity=quantity,
            price_at_sale=price,
            status=status,
            **seed_delivery_fields(status, order_date, client.client_id),
            assigned_route=client.route,
            assigned_driver=client.route.driver,
        ))

    standing_by_day = {}
    for standing_order in standing_orders:
        standing_by_day.setdefault(standing_order.day_of_week, []).append(standing_order)

    for order_date in date_range:
        weekday = order_date.weekday()

        for standing_order in standing_by_day.get(weekday, []):
            client = clients_by_id[standing_order.client_id]
            if not standing_order.is_active or not delivers_on(client, order_date):
                continue
            variance_steps = ((standing_order.client_id + order_date.toordinal()) % 5) - 2
            variance = 1 + (variance_steps * 0.1)
            quantity = max(1, round(standing_order.quantity * variance * demand_factor(client, order_date)))
            add(
                client, products_by_id[standing_order.product_id], order_date, quantity,
                standing_order.price_at_sale, day_status(client.client_id, order_date, today),
            )

        if order_date.toordinal() % 5 == 0 and weekday != 6:
            for i in range(AD_HOC_ORDERS_PER_TRIGGER_DAY):
                client = clients_by_id[active_ids[(order_date.toordinal() + i) % len(active_ids)]]
                product = product_list[(order_date.toordinal() + i * 3) % len(product_list)]
                if not delivers_on(client, order_date):
                    continue
                add(
                    client, product, order_date, 5 + (i * 4), product.base_price,
                    day_status(client.client_id, order_date, today),
                )

    DailyOrder.objects.bulk_create(new_orders, batch_size=1000)
    return len(new_orders)


def _settle(orders, today):
    for order in orders:
        order.status = day_status(order.client_id, order.order_date, today)
        for field, value in seed_delivery_fields(order.status, order.order_date, order.client_id).items():
            setattr(order, field, value)
    DailyOrder.objects.bulk_update(
        orders, ['status', 'delivered_at', 'delivery_note', 'failure_reason', 'failure_note', 'failed_at'],
        batch_size=1000,
    )
    return len(orders)


def close_past_orders(today):
    return _settle(list(DailyOrder.objects.filter(order_date__lt=today, status__in=OPEN_STATUSES)), today)


def start_today_orders(today):
    waiting = DailyOrder.objects.filter(order_date=today, status__in=['planned', 'in_production'])
    return _settle(list(waiting), today)


def create_product_returns(date_range):
    yesterday = date_range[-1] - timedelta(days=1)
    delivered = (
        DailyOrder.objects
        .filter(order_date__range=(date_range[0], yesterday), status='delivered')
        .select_related('client', 'product')
        .order_by('client_id', 'order_date')
    )
    deliveries = {}
    for order in delivered:
        if order.client.name.startswith(RETURNING_CLIENTS):
            deliveries.setdefault(order.client_id, {}).setdefault(order.order_date, []).append(order)

    taken = set(
        ProductReturn.objects
        .filter(return_date__range=(date_range[0], yesterday))
        .values_list('client_id', 'product_id', 'return_date')
    )
    new_returns = []
    for client_id, days in deliveries.items():
        dates = list(days)
        for source_date, return_date in zip(dates, dates[1:]):
            seed = client_id + return_date.toordinal()
            if seed % RETURN_EVERY:
                continue
            for order in days[source_date]:
                key = (client_id, order.product_id, return_date)
                if order.product.category not in RETURNED_CATEGORIES or key in taken:
                    continue
                share = (5 + (order.product_id + seed) % 16) / 100
                new_returns.append(ProductReturn(
                    client_id=client_id,
                    product_id=order.product_id,
                    return_date=return_date,
                    source_date=source_date,
                    quantity=max(1, round(order.quantity * share)),
                    unit_price=order.price_at_sale,
                    recorded_by_id=days[return_date][0].assigned_driver_id,
                ))
    ProductReturn.objects.bulk_create(new_returns, batch_size=1000)
    return len(new_returns)