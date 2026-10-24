from datetime import date, timedelta
from io import StringIO

from django.core.management import CommandError, call_command
from django.test import TestCase

from dashboard.seed.clients import create_clients, create_routes
from dashboard.seed.orders import create_standing_orders
from dashboard.seed.products import create_ingredients, create_products
from orders.models import DailyOrder, StandingOrder
from users.models import User

WEDNESDAY = date(2026, 10, 21)


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
        self.standing_orders = create_standing_orders(self.clients, self.products)

    def run_for(self, day, *args):
        out = StringIO()
        call_command('seed_today_deliveries', '--date', day.isoformat(), *args, stdout=out)
        return out.getvalue()

    def test_creates_the_days_orders_from_standing_orders(self):
        output = self.run_for(WEDNESDAY)

        expected = {
            (so.client_id, so.product_id) for so in self.standing_orders if so.day_of_week == WEDNESDAY.weekday()
        }
        created = set(DailyOrder.objects.filter(order_date=WEDNESDAY).values_list('client_id', 'product_id'))
        self.assertTrue(expected <= created)
        self.assertIn('Gotowe', output)

    def test_nothing_is_delivered_on_a_holiday(self):
        self.run_for(date(2026, 11, 11))

        self.assertFalse(DailyOrder.objects.filter(order_date=date(2026, 11, 11)).exists())

    def test_closes_unfinished_orders_from_previous_days(self):
        self.run_for(WEDNESDAY)
        self.assertTrue(DailyOrder.objects.filter(order_date=WEDNESDAY, status='planned').exists())

        self.run_for(WEDNESDAY + timedelta(days=1))

        wednesday = DailyOrder.objects.filter(order_date=WEDNESDAY)
        self.assertFalse(wednesday.filter(status__in=['planned', 'in_production', 'in_delivery']).exists())
        self.assertFalse(wednesday.filter(status='delivered', delivered_at__isnull=True).exists())
        self.assertFalse(wednesday.filter(status='failed', failure_reason='').exists())
        
    def test_prepares_tomorrow_and_starts_today(self):
        thursday = WEDNESDAY + timedelta(days=1)
        self.run_for(WEDNESDAY)
        self.assertEqual(set(DailyOrder.objects.filter(order_date=thursday).values_list('status', flat=True)), {'planned'})

        self.run_for(thursday)

        statuses = set(DailyOrder.objects.filter(order_date=thursday).values_list('status', flat=True))
        self.assertIn('delivered', statuses)
        self.assertTrue(DailyOrder.objects.filter(order_date=thursday + timedelta(days=1), status='planned').exists())


    def test_is_idempotent_without_clear(self):
        self.run_for(WEDNESDAY)
        first_count = DailyOrder.objects.count()

        self.run_for(WEDNESDAY)

        self.assertEqual(DailyOrder.objects.count(), first_count)

    def test_clear_today_removes_existing_orders_first(self):
        self.run_for(WEDNESDAY)
        product = next(iter(self.products.values()))
        extra = DailyOrder.objects.create(
            client=self.clients[0], product=product, order_date=WEDNESDAY,
            quantity=1, price_at_sale=product.base_price, status='cancelled',
        )

        self.run_for(WEDNESDAY, '--clear-today')

        self.assertFalse(DailyOrder.objects.filter(pk=extra.pk).exists())
        self.assertTrue(DailyOrder.objects.filter(order_date=WEDNESDAY).exists())

    def test_refuses_without_standing_orders(self):
        StandingOrder.objects.all().delete()

        with self.assertRaises(CommandError):
            self.run_for(WEDNESDAY)