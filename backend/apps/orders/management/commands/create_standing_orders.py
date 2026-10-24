from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from common.holidays import is_holiday
from orders.standing import SYSTEM_ACTOR, create_orders_from_standing, record_standing_run, summarize_by_client


class Command(BaseCommand):
    help = (
        'Tworzy zamówienia dzienne z zamówień stałych (domyślnie na jutro) '
        'dla klientów, którzy nie mają jeszcze zamówienia na ten dzień.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--date',
            type=date.fromisoformat,
            default=None,
            help='Dzień w formacie RRRR-MM-DD (domyślnie jutro)',
        )
        parser.add_argument(
            '--include-holidays',
            action='store_true',
            help='Twórz zamówienia także w święta ustawowe',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        order_date = options['date'] or timezone.localdate() + timedelta(days=1)
        if is_holiday(order_date) and not options['include_holidays']:
            self.stdout.write(f'{order_date} to święto – pominięto.')
            return

        created = create_orders_from_standing(order_date)
        if created:
            record_standing_run(None, order_date, created, actor_name=SYSTEM_ACTOR)
        self.stdout.write(self.style.SUCCESS(
            f'Utworzono {len(created)} pozycji dla {len(summarize_by_client(created))} klientów na {order_date}.'
        ))