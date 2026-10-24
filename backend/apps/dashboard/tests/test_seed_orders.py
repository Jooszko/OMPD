from datetime import date, timedelta

from django.test import SimpleTestCase, TestCase

from clients.models import Client

from orders.models import DailyOrder, ProductReturn, StandingOrder
from dashboard.seed.clients import create_clients, create_routes
from dashboard.seed.dates import build_date_range
from dashboard.seed.products import create_ingredients, create_products
from dashboard.seed.orders import create_daily_orders, create_product_returns, create_standing_orders, demand_factor
from dashboard.services.returns import last_delivery_items
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

    def test_standing_orders_follow_client_profiles(self):
        standing_orders = create_standing_orders(self.clients, self.products)

        self.assertEqual(StandingOrder.objects.count(), len(standing_orders))
        self.assertGreater(len(standing_orders), 600)
        canteen = next(c for c in self.clients if c.name.startswith('Stołówka'))
        self.assertEqual(set(canteen.standing_orders.values_list('day_of_week', flat=True)), {0, 1, 2, 3, 4})
        for client in self.clients:
            baskets = {}
            for so in client.standing_orders.all():
                baskets.setdefault(so.day_of_week, set()).add((so.product_id, so.quantity))
            self.assertLessEqual(len({frozenset(basket) for basket in baskets.values()}), 1, client.name)

    def test_inactive_clients_get_no_standing_orders(self):
        create_standing_orders(self.clients, self.products)

        self.assertFalse(StandingOrder.objects.filter(client__is_active=False).exists())

    def test_create_daily_orders_populates_full_date_range(self):
        standing_orders = create_standing_orders(self.clients, self.products)

        created_count = create_daily_orders(
            self.clients, self.products, standing_orders, self.date_range
        )

        self.assertGreater(created_count, 0)
        self.assertEqual(DailyOrder.objects.count(), created_count)
        dates_with_orders = set(DailyOrder.objects.values_list('order_date', flat=True))
        self.assertGreater(len(dates_with_orders), 20)
        valid_statuses = {'planned', 'in_production', 'in_delivery', 'delivered', 'failed', 'cancelled'}
        used_statuses = set(DailyOrder.objects.values_list('status', flat=True))
        self.assertTrue(used_statuses.issubset(valid_statuses))

    def test_create_daily_orders_is_idempotent(self):
        standing_orders = create_standing_orders(self.clients, self.products)
        create_daily_orders(self.clients, self.products, standing_orders, self.date_range)
        first_count = DailyOrder.objects.count()

        create_daily_orders(self.clients, self.products, standing_orders, self.date_range)

        self.assertEqual(DailyOrder.objects.count(), first_count)

    def test_seeded_delivered_and_failed_orders_have_event_details(self):
        standing_orders = create_standing_orders(self.clients, self.products)
        create_daily_orders(self.clients, self.products, standing_orders, self.date_range)

        delivered = DailyOrder.objects.filter(status='delivered')
        failed = DailyOrder.objects.filter(status='failed')
        self.assertTrue(delivered.exists())
        self.assertTrue(failed.exists())
        self.assertFalse(delivered.filter(delivered_at__isnull=True).exists())
        self.assertFalse(failed.filter(failed_at__isnull=True).exists())
        self.assertFalse(failed.filter(failure_reason='').exists())

    def test_no_deliveries_on_holidays_and_only_some_on_sundays(self):
        standing_orders = create_standing_orders(self.clients, self.products)

        create_daily_orders(self.clients, self.products, standing_orders, build_date_range(date(2026, 11, 12), 14))

        self.assertFalse(DailyOrder.objects.filter(order_date__in=[date(2026, 11, 1), date(2026, 11, 11)]).exists())
        sunday = DailyOrder.objects.filter(order_date=date(2026, 11, 8)).values_list('client__name', flat=True)
        self.assertEqual({name.split(' ')[0] for name in sunday}, {'Restauracja', 'Kawiarnia', 'Hotel'})

    def test_canteens_take_a_summer_break(self):
        standing_orders = create_standing_orders(self.clients, self.products)

        create_daily_orders(self.clients, self.products, standing_orders, self.date_range)

        canteen_days = DailyOrder.objects.filter(client__name__startswith='Stołówka').values_list('order_date', flat=True)
        self.assertTrue(any(day.month == 6 for day in canteen_days))
        self.assertFalse(any(day.month == 7 for day in canteen_days))

    def test_failures_are_rare_and_explained(self):
        standing_orders = create_standing_orders(self.clients, self.products)

        create_daily_orders(self.clients, self.products, standing_orders, self.date_range)

        past = DailyOrder.objects.exclude(order_date=self.date_range[-1])
        failed = past.filter(status='failed')
        self.assertLess(failed.count() / past.count(), 0.1)
        self.assertFalse(failed.filter(failure_note='').exists())
        self.assertGreater(len(set(failed.values_list('failure_reason', flat=True))), 2)
        self.assertTrue(past.filter(status='delivered').exclude(delivery_note='').exists())

    def test_returns_come_from_the_previous_delivery(self):
        standing_orders = create_standing_orders(self.clients, self.products)
        create_daily_orders(self.clients, self.products, standing_orders, self.date_range)

        created_count = create_product_returns(self.date_range)

        self.assertGreater(created_count, 0)
        for product_return in ProductReturn.objects.select_related('product')[:30]:
            source = DailyOrder.objects.get(
                client_id=product_return.client_id, product_id=product_return.product_id,
                order_date=product_return.source_date,
            )
            self.assertEqual(source.status, 'delivered')
            self.assertLessEqual(product_return.quantity, source.quantity)
            self.assertIn(product_return.product.category, ('buns', 'pastry'))
            last = last_delivery_items([product_return.client_id], product_return.return_date)
            self.assertEqual(last[product_return.client_id]['source_date'], product_return.source_date)
        self.assertEqual(create_product_returns(self.date_range), 0)

    def test_orders_for_tomorrow_are_only_planned(self):
        standing_orders = create_standing_orders(self.clients, self.products)
        tomorrow = self.date_range[-1] + timedelta(days=1)

        create_daily_orders(self.clients, self.products, standing_orders, [tomorrow], self.date_range[-1])

        statuses = set(DailyOrder.objects.filter(order_date=tomorrow).values_list('status', flat=True))
        self.assertEqual(statuses, {'planned'})

class DemandFactorTests(SimpleTestCase):
    def test_saturdays_holiday_eves_and_summer_in_the_mountains_sell_more(self):
        skoczow = Client(name='Sklep', address='Rynek 1, Skoczów')
        ustron = Client(name='Sklep', address='Rynek 3, Ustroń')

        self.assertGreater(demand_factor(skoczow, date(2026, 10, 24)), demand_factor(skoczow, date(2026, 10, 19)))
        self.assertAlmostEqual(demand_factor(skoczow, date(2026, 10, 31)), 1.3 * 1.4)
        self.assertAlmostEqual(demand_factor(ustron, date(2026, 7, 14)), 1.4)
        self.assertAlmostEqual(demand_factor(skoczow, date(2026, 7, 14)), 1.0)