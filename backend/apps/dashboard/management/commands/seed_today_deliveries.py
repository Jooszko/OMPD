from datetime import date, timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from clients.models import Client
from orders.models import DailyOrder, StandingOrder
from products.models import Product
from dashboard.seed.orders import close_past_orders, create_daily_orders, start_today_orders


class Command(BaseCommand):
    help = (
        'Tworzy zamówienia na dziś i jutro z zamówień stałych, rusza z dzisiejszymi dostawami '
        'i zamyka niedokończone z poprzednich dni (codzienne odświeżenie serwera demo, bez pełnego re-seedu).'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--date',
            type=date.fromisoformat,
            default=None,
            help='Dzień, dla którego utworzyć zamówienia, w formacie RRRR-MM-DD (domyślnie dzisiaj)',
        )
        parser.add_argument(
            '--clear-today',
            action='store_true',
            help='Usuń wszystkie istniejące zamówienia z tego dnia przed utworzeniem nowych',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        today = options['date'] or date.today()

        standing_orders = list(StandingOrder.objects.filter(is_active=True))
        if not standing_orders:
            raise CommandError('Brak zamówień stałych — najpierw uruchom `python manage.py seed_dashboard`.')

        if options['clear_today']:
            deleted, _ = DailyOrder.objects.filter(order_date=today).delete()
            self.stdout.write(f'Usunięto {deleted} zamówień z dnia {today}.')

        closed_count = close_past_orders(today)
        clients = list(Client.objects.filter(is_active=True).order_by('client_id'))
        products = {product.name: product for product in Product.objects.all()}
        created_count = create_daily_orders(clients, products, standing_orders, [today])
        started_count = start_today_orders(today)
        tomorrow_count = create_daily_orders(clients, products, standing_orders, [today + timedelta(days=1)], today)

        self.stdout.write(self.style.SUCCESS(
            f'Gotowe: {created_count} nowych zamówień na {today}, {started_count} ruszyło do realizacji, '
            f'{tomorrow_count} na jutro, zamknięto {closed_count} zaległych z poprzednich dni.'
        ))