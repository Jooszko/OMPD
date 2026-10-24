from datetime import date, timedelta
from decouple import config
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from dashboard.seed.clear import clear_all
from dashboard.seed.clients import create_clients, create_routes
from dashboard.seed.dates import DEFAULT_SEED_DAYS, build_date_range
from dashboard.seed.finance import UNCLOSED_DAYS, create_expenses, create_financial_reports, create_recurring_costs
from dashboard.seed.orders import create_daily_orders, create_product_returns, create_standing_orders
from dashboard.seed.plans import create_production_history
from dashboard.seed.production import create_production_setup
from dashboard.seed.proofs import create_delivery_proofs
from dashboard.seed.products import create_ingredients, create_products
from dashboard.seed.suppliers import (
    create_supplier_ingredients,
    create_suppliers,
    create_supply_orders,
)
from orders.standing import mark_standing_days
from dashboard.seed.users import DEFAULT_SEED_PASSWORD, DEMO_USERNAMES, create_notifications, create_users


class Command(BaseCommand):
    help = 'Wypełnia bazę danych kompletnymi danymi testowymi (skala ~50-osobowej piekarni)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Usuń istniejące dane testowe przed dodaniem nowych',
        )
        parser.add_argument(
            '--password',
            help='Hasło kont testowych (domyślnie zmienna SEED_PASSWORD, a lokalnie przy DEBUG=True bakery2026)',
        )
        parser.add_argument(
            '--demo',
            action='store_true',
            help=f'Zostaw aktywne tylko konta do pokazu: {", ".join(DEMO_USERNAMES)}',
        )
        parser.add_argument(
            '--days',
            type=int,
            default=DEFAULT_SEED_DAYS,
            help=f'Ile dni historii wygenerować, łącznie z dzisiejszym (domyślnie {DEFAULT_SEED_DAYS})',
        )

    def _password(self, options):
        password = options['password'] or config('SEED_PASSWORD', default='')
        if not password:
            if settings.DEBUG:
                return DEFAULT_SEED_PASSWORD
            raise CommandError('Przy DEBUG=False podaj hasło kont: --password albo zmienna SEED_PASSWORD.')
        try:
            validate_password(password)
        except ValidationError as error:
            raise CommandError(' '.join(error.messages))
        return password

    @transaction.atomic
    def handle(self, *args, **options):
        if options['clear']:
            clear_all()
            self.stdout.write('Usunięto istniejące dane testowe.')
        if options['days'] < 7:
            raise CommandError('Historia musi mieć co najmniej 7 dni (--days 7).')

        password = self._password(options)
        today = date.today()
        date_range = build_date_range(today, options['days'])

        users = create_users(password=password, demo=options['demo'])
        self.stdout.write(f"  Użytkownicy: {sum(len(v) for v in users.values())}")

        routes = create_routes(users['drivers'])
        self.stdout.write(f'  Trasy: {len(routes)}')

        clients = create_clients(routes)
        self.stdout.write(f'  Klienci: {len(clients)}')

        ingredients = create_ingredients()
        self.stdout.write(f'  Składniki: {len(ingredients)}')

        products = create_products(ingredients)
        self.stdout.write(f'  Produkty: {len(products)}')

        mixers, doughs, bake_specs = create_production_setup(ingredients, products)
        self.stdout.write(
            f'  Produkcja: {len(mixers)} mieszałki, {len(doughs)} ciasta, {len(bake_specs)} wyrobów przypisanych'
        )

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

        tomorrow_count = create_daily_orders(clients, products, standing_orders, [today + timedelta(days=1)], today)
        self.stdout.write(f'  Zamówienia na jutro: {tomorrow_count}')
        mark_standing_days(today, today + timedelta(days=1))

        returns_count = create_product_returns(date_range)
        self.stdout.write(f'  Zwroty: {returns_count}')

        proofs_count = create_delivery_proofs(today)
        self.stdout.write(f'  Dowody dostaw: {proofs_count}')

        bakers = [baker for baker in users['bakers'] if baker.is_active]
        plans_count = create_production_history(today, bakers)
        self.stdout.write(f'  Plany produkcji: {plans_count}')

        expenses_count = create_expenses(date_range, admin_user)
        self.stdout.write(f'  Wydatki: {expenses_count}')

        recurring_count = create_recurring_costs(date_range, admin_user)
        self.stdout.write(f'  Wydatki cykliczne: {recurring_count}')

        reports_count = create_financial_reports(date_range, admin_user, open_days=UNCLOSED_DAYS)
        self.stdout.write(f'  Raporty finansowe: {reports_count}')

        notifications_count = create_notifications(users)
        self.stdout.write(f'  Powiadomienia: {notifications_count}')

        self.stdout.write(self.style.SUCCESS(
            f'Dane testowe załadowane dla zakresu: {date_range[0]} - {date_range[-1]}'
        ))
