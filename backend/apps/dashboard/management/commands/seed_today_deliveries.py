from datetime import date

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from clients.models import Route
from orders.models import DailyOrder
from products.models import Product
from dashboard.seed.orders import seed_delivery_fields

STATUS_CYCLE = ['planned', 'in_production', 'in_delivery', 'delivered']


class Command(BaseCommand):
    help = (
        'Dosypuje dzisiejsze zamówienia (DailyOrder) do aktywnych tras, żeby moduł '
        'logistyki miał co pokazać podczas ręcznego testowania (bez pełnego re-seedu).'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--per-route',
            type=int,
            default=3,
            help='Ilu klientom na trasę przydzielić dzisiejsze zamówienie (domyślnie 3)',
        )
        parser.add_argument(
            '--clear-today',
            action='store_true',
            help='Usuń wszystkie istniejące dzisiejsze zamówienia przed dosypaniem nowych',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        today = date.today()
        per_route = options['per_route']

        if options['clear_today']:
            deleted, _ = DailyOrder.objects.filter(order_date=today).delete()
            self.stdout.write(f'Usunięto {deleted} dzisiejszych zamówień.')

        products = list(Product.objects.all())
        if not products:
            raise CommandError('Brak produktów w bazie — najpierw uruchom `python manage.py seed_dashboard`.')

        routes = list(Route.objects.filter(is_active=True).prefetch_related('clients'))
        if not routes:
            raise CommandError('Brak aktywnych tras — najpierw uruchom `python manage.py seed_dashboard`.')

        created_count = 0
        touched_routes = 0
        for route in routes:
            clients = list(route.clients.filter(is_active=True).order_by('client_id')[:per_route])
            if not clients:
                continue
            touched_routes += 1
            for i, client in enumerate(clients):
                product = products[(client.client_id + i) % len(products)]
                status = STATUS_CYCLE[(client.client_id + i) % len(STATUS_CYCLE)]
                _, created = DailyOrder.objects.get_or_create(
                    client=client,
                    product=product,
                    order_date=today,
                    defaults={
                        'quantity': 5 + (i * 3),
                        'price_at_sale': product.base_price,
                        'status': status,
                        **seed_delivery_fields(status, today, client.client_id),
                    },
                )
                if created:
                    created_count += 1

        self.stdout.write(self.style.SUCCESS(
            f'Gotowe: {created_count} nowych zamówień na dziś ({today}) w {touched_routes} trasach.'
        ))
