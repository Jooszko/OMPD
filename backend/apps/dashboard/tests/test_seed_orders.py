from datetime import date

from django.test import TestCase

from orders.models import DailyOrder, StandingOrder
from dashboard.seed.clients import create_clients, create_routes
from dashboard.seed.dates import build_date_range
from dashboard.seed.products import create_ingredients, create_products
from dashboard.seed.orders import create_daily_orders, create_standing_orders
from users.models import User


class SeedOrdersTests(TestCase):
    def setUp(self):
        drivers = [
            User.objects.create_user(
                username=f'driver{i}', password='x', role='driver', full_name=f'Driver {i}'
            )
            for i in range(6)
        ]
        routes = create_routes(drivers)
        self.clients = create_clients(routes)
        ingredients = create_ingredients()
        self.products = create_products(ingredients)
        self.date_range = build_date_range(date(2026, 7, 8))

    def test_create_standing_orders_creates_between_45_and_50(self):
        standing_orders = create_standing_orders(self.clients, self.products)

        self.assertGreaterEqual(len(standing_orders), 45)
        self.assertLessEqual(len(standing_orders), 50)
        self.assertEqual(StandingOrder.objects.count(), len(standing_orders))

        seen_keys = set()
        for so in standing_orders:
            key = (so.client_id, so.product_id, so.day_of_week)
            self.assertNotIn(key, seen_keys)
            seen_keys.add(key)

    def test_create_daily_orders_populates_full_date_range(self):
        standing_orders = create_standing_orders(self.clients, self.products)

        created_count = create_daily_orders(
            self.clients, self.products, standing_orders, self.date_range
        )

        self.assertGreater(created_count, 0)
        self.assertEqual(DailyOrder.objects.count(), created_count)
        dates_with_orders = set(DailyOrder.objects.values_list('order_date', flat=True))
        self.assertGreater(len(dates_with_orders), 20)
        valid_statuses = {'planned', 'in_production', 'in_delivery', 'delivered', 'cancelled'}
        used_statuses = set(DailyOrder.objects.values_list('status', flat=True))
        self.assertTrue(used_statuses.issubset(valid_statuses))

    def test_create_daily_orders_is_idempotent(self):
        standing_orders = create_standing_orders(self.clients, self.products)
        create_daily_orders(self.clients, self.products, standing_orders, self.date_range)
        first_count = DailyOrder.objects.count()

        create_daily_orders(self.clients, self.products, standing_orders, self.date_range)

        self.assertEqual(DailyOrder.objects.count(), first_count)
