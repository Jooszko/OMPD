from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from audit.services import record_event
from clients.models import Client
from common.holidays import is_holiday

from .models import DailyOrder, StandingOrder, StandingOrderRun

SYSTEM_ACTOR = 'System (zamówienia stałe)'
AUTO_DAYS_AHEAD = 1


def standing_orders_due(order_date):
    clients_with_orders = DailyOrder.objects.filter(order_date=order_date).values('client_id')
    return list(
        StandingOrder.objects
        .filter(day_of_week=order_date.weekday(), is_active=True, client__is_active=True)
        .exclude(client_id__in=clients_with_orders)
        .select_related('client', 'product')
        .order_by('client__name', 'product__name')
    )


def summarize_by_client(standing_orders):
    clients = {}
    for standing_order in standing_orders:
        entry = clients.setdefault(standing_order.client_id, {
            'client_id': standing_order.client_id,
            'client_name': standing_order.client.name,
            'items': 0,
            'total_quantity': 0,
        })
        entry['items'] += 1
        entry['total_quantity'] += standing_order.quantity
    return list(clients.values())


def create_orders_from_standing(order_date):
    candidate_ids = StandingOrder.objects.filter(
        day_of_week=order_date.weekday(), is_active=True,
    ).values_list('client_id', flat=True)
    list(Client.objects.select_for_update().filter(pk__in=candidate_ids))

    due = standing_orders_due(order_date)
    StandingOrderRun.objects.get_or_create(order_date=order_date)
    DailyOrder.objects.bulk_create([
        DailyOrder(
            client=standing_order.client,
            product=standing_order.product,
            order_date=order_date,
            quantity=standing_order.quantity,
            price_at_sale=standing_order.price_at_sale,
            status='planned',
        )
        for standing_order in due
    ])
    return due


def record_standing_run(request, order_date, created, actor_name=None):
    clients = summarize_by_client(created)
    record_event(
        request, category='orders', action='order.created_from_standing', actor_name=actor_name,
        object_label=f'{order_date:%d.%m.%Y}',
        description=(
            f'Utworzono zamówienia z zamówień stałych na {order_date:%d.%m.%Y} '
            f'dla {len(clients)} klientów.'
        ),
        changes=[
            {
                'field': str(entry['client_id']),
                'label': entry['client_name'],
                'old': None,
                'new': f"{entry['items']} poz., {entry['total_quantity']} szt.",
            }
            for entry in clients
        ],
    )


def mark_standing_days(*dates):
    StandingOrderRun.objects.bulk_create(
        [StandingOrderRun(order_date=order_date) for order_date in dates], ignore_conflicts=True,
    )


def ensure_standing_orders(today=None):
    today = today or timezone.localdate()
    for offset in range(AUTO_DAYS_AHEAD + 1):
        order_date = today + timedelta(days=offset)
        with transaction.atomic():
            if StandingOrderRun.objects.filter(order_date=order_date).exists():
                continue
            if is_holiday(order_date):
                mark_standing_days(order_date)
                continue
            created = create_orders_from_standing(order_date)
            if created:
                record_standing_run(None, order_date, created, actor_name=SYSTEM_ACTOR)