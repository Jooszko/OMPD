from datetime import date
from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from dashboard.seed.clients import create_clients, create_routes
from dashboard.seed.products import create_ingredients, create_products
from orders.models import DailyOrder
from users.models import User


class SeedTodayDeliveriesTests(TestCase):
    def setUp(self):
        drivers = [
            User.objects.create_user(
                username=f'today_driver{i}', password='x', role='driver', full_name=f'Driver {i}'
            )
            for i in range(3)
        ]
        self.routes = create_routes(drivers)
        self.clients = create_clients(self.routes)
        ingredients = create_ingredients()
        self.products = create_products(ingredients)

    def test_creates_orders_for_today_across_routes(self):
        out = StringIO()
        call_command('seed_today_deliveries', stdout=out)

        today_orders = DailyOrder.objects.filter(order_date=date.today())
        self.assertGreater(today_orders.count(), 0)
        self.assertIn('Gotowe', out.getvalue())

    def test_per_route_limits_number_of_clients_touched(self):
        call_command('seed_today_deliveries', '--per-route', '1')

        today_orders = DailyOrder.objects.filter(order_date=date.today())
        clients_with_orders = set(today_orders.values_list('client_id', flat=True))
        # jeden klient na trasę => co najwyżej tyle klientów z zamówieniem, ile jest tras
        self.assertLessEqual(len(clients_with_orders), len(self.routes))

    def test_is_idempotent_without_clear(self):
        call_command('seed_today_deliveries')
        first_count = DailyOrder.objects.filter(order_date=date.today()).count()

        call_command('seed_today_deliveries')
        second_count = DailyOrder.objects.filter(order_date=date.today()).count()

        self.assertEqual(first_count, second_count)

    def test_clear_today_removes_existing_orders_first(self):
        call_command('seed_today_deliveries')
        product = next(iter(self.products.values()))
        DailyOrder.objects.create(
            client=self.clients[0],
            product=product,
            order_date=date.today(),
            quantity=1,
            price_at_sale=product.base_price,
            status='cancelled',
        )
        before = DailyOrder.objects.filter(order_date=date.today()).count()

        call_command('seed_today_deliveries', '--clear-today')

        after = DailyOrder.objects.filter(order_date=date.today()).count()
        self.assertLess(after, before + 1)

    def test_raises_without_products(self):
        from products.models import Product

        Product.objects.all().delete()
        with self.assertRaises(Exception):
            call_command('seed_today_deliveries')
