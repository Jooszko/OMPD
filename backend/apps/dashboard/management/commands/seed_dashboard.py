from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction

from dashboard.seed.clear import clear_all
from dashboard.seed.clients import create_clients, create_routes
from dashboard.seed.dates import build_date_range
from dashboard.seed.finance import create_expenses, create_financial_reports
from dashboard.seed.orders import create_daily_orders, create_standing_orders
from dashboard.seed.products import create_ingredients, create_products
from dashboard.seed.suppliers import (
    create_supplier_ingredients,
    create_suppliers,
    create_supply_orders,
)
from dashboard.seed.users import create_notifications, create_users


class Command(BaseCommand):
    help = 'Wypełnia bazę danych kompletnymi danymi testowymi (skala ~50-osobowej piekarni)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Usuń istniejące dane testowe przed dodaniem nowych',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options['clear']:
            clear_all()
            self.stdout.write('Usunięto istniejące dane testowe.')

        today = date.today()
        date_range = build_date_range(today)

        users = create_users()
        self.stdout.write(f"  Użytkownicy: {sum(len(v) for v in users.values())}")

        routes = create_routes(users['drivers'])
        self.stdout.write(f'  Trasy: {len(routes)}')

        clients = create_clients(routes)
        self.stdout.write(f'  Klienci: {len(clients)}')

        ingredients = create_ingredients()
        self.stdout.write(f'  Składniki: {len(ingredients)}')

        products = create_products(ingredients)
        self.stdout.write(f'  Produkty: {len(products)}')

        suppliers = create_suppliers()
        self.stdout.write(f'  Dostawcy: {len(suppliers)}')

        supplier_links = create_supplier_ingredients(suppliers, ingredients)
        self.stdout.write(f'  Powiązania dostawca-surowiec: {len(supplier_links)}')

        admin_user = users['admins'][0]
        supply_orders = create_supply_orders(suppliers, supplier_links, admin_user, date_range)
        self.stdout.write(f'  Zamówienia surowcowe: {len(supply_orders)}')

        standing_orders = create_standing_orders(clients, products)
        self.stdout.write(f'  Szablony stałych zamówień: {len(standing_orders)}')

        daily_orders_count = create_daily_orders(clients, products, standing_orders, date_range)
        self.stdout.write(f'  Zamówienia dzienne: {daily_orders_count}')

        expenses_count = create_expenses(date_range, admin_user)
        self.stdout.write(f'  Wydatki: {expenses_count}')

        reports_count = create_financial_reports(date_range)
        self.stdout.write(f'  Raporty finansowe: {reports_count}')

        notifications_count = create_notifications(users)
        self.stdout.write(f'  Powiadomienia: {notifications_count}')

        self.stdout.write(self.style.SUCCESS(
            f'Dane testowe załadowane dla zakresu: {date_range[0]} - {date_range[-1]}'
        ))
