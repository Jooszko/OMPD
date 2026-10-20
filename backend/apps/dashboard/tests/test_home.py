from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.test import TestCase
from rest_framework.test import APIClient

from audit.models import AuditEntry
from clients.models import Client, Route
from dashboard.services.home import build_alerts, production_shift, routes_today, today_orders
from finance.models import DailyFinancialReport
from orders.models import DailyOrder, StandingOrder
from production.models import Dough, ProductionBatch, ProductionPlan
from products.models import Ingredient, IngredientStock, Product, Recipe
from users.models import User

TODAY = date(2026, 10, 20)
SHIFT_NOW = datetime(2026, 10, 20, 10, 0, tzinfo=ZoneInfo('Europe/Warsaw'))
NIGHT_NOW = datetime(2026, 10, 21, 3, 0, tzinfo=ZoneInfo('Europe/Warsaw'))


class HomeTestBase(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='admin_h', password='x', role='admin', full_name='Anna Admin')
        self.baker = User.objects.create_user(username='baker_h', password='x', role='baker', full_name='Piotr Piekarz')
        driver = User.objects.create_user(username='driver_h', password='x', role='driver', full_name='Kierowca')
        self.route = Route.objects.create(route_name='Trasa 1', driver=driver)
        self.other_route = Route.objects.create(route_name='Trasa 2', driver=driver)
        self.hotel = Client.objects.create(name='Hotel', address='Rynek 1', route=self.route)
        self.shop = Client.objects.create(name='Sklep', address='Rynek 2', route=self.other_route)
        self.bread = Product.objects.create(name='Chleb', category='bread', base_price=Decimal('5.00'))
        self.roll = Product.objects.create(name='Bułka', category='bread', base_price=Decimal('1.00'))
        self.flour = Ingredient.objects.create(name='Mąka', unit='kg')
        Recipe.objects.create(product=self.bread, ingredient=self.flour, amount=Decimal('0.400'))

    def order(self, client, product, quantity, status='planned', day=TODAY):
        return DailyOrder.objects.create(
            client=client, product=product, order_date=day, quantity=quantity,
            price_at_sale=product.base_price, status=status,
        )


class TodayOrdersTests(HomeTestBase):
    def test_counts_orders_by_status_and_skips_cancelled(self):
        self.order(self.hotel, self.bread, 10, 'delivered')
        self.order(self.hotel, self.roll, 30, 'in_delivery')
        self.order(self.shop, self.bread, 5, 'failed')
        self.order(self.shop, self.roll, 99, 'cancelled')

        data = today_orders(TODAY)

        self.assertEqual(data['total'], 3)
        self.assertEqual(data['clients'], 2)
        self.assertEqual(data['routes'], 2)
        self.assertEqual(data['pieces'], 40)
        self.assertEqual(data['by_status'], {
            'planned': 0, 'in_production': 0, 'in_delivery': 1, 'delivered': 1, 'failed': 1,
        })
        self.assertEqual([item['route_name'] for item in data['items']], ['Trasa 1', 'Trasa 1', 'Trasa 2'])

class RoutesTodayTests(HomeTestBase):
    def setUp(self):
        super().setUp()
        self.hotel.latitude, self.hotel.longitude = Decimal('49.822'), Decimal('19.044')
        self.hotel.save()
        self.cafe = Client.objects.create(name='Kawiarnia', address='Rynek 3', route=self.route)

    def delivered(self, order, hour):
        order.delivered_at = datetime(2026, 10, 20, hour, 15, tzinfo=ZoneInfo('Europe/Warsaw'))
        order.save()

    def test_route_shows_progress_and_last_delivery(self):
        self.delivered(self.order(self.hotel, self.bread, 10, 'delivered'), 7)
        self.delivered(self.order(self.hotel, self.roll, 20, 'delivered'), 8)
        self.order(self.cafe, self.bread, 5, 'in_delivery')
        self.order(self.shop, self.roll, 30, 'in_production')

        first, second = routes_today(TODAY)

        self.assertEqual((first['route_name'], first['driver_name']), ('Trasa 1', 'Kierowca'))
        self.assertEqual((first['state'], first['delivered_stops'], first['total_stops']), ('on_road', 1, 2))
        self.assertEqual(first['last_delivery'], {'client_name': 'Hotel', 'delivered_at': '2026-10-20T08:15:00+02:00'})
        self.assertEqual(
            [(s['client_name'], s['status'], s['latitude']) for s in first['stops']],
            [('Hotel', 'delivered', 49.822), ('Kawiarnia', 'in_delivery', None)],
        )
        self.assertEqual((second['state'], second['last_delivery']), ('waiting', None))

    def test_route_is_done_when_every_stop_is_closed(self):
        self.order(self.hotel, self.bread, 10, 'delivered')
        self.order(self.cafe, self.bread, 5, 'failed')

        route = routes_today(TODAY)[0]

        self.assertEqual(route['state'], 'done')
        self.assertEqual([s['status'] for s in route['stops']], ['delivered', 'failed'])
        
    def test_partly_delivered_stop_is_not_the_last_delivery(self):
        self.delivered(self.order(self.hotel, self.bread, 10, 'delivered'), 9)
        self.order(self.hotel, self.roll, 20, 'planned')
        self.order(self.cafe, self.bread, 5, 'in_delivery')

        route = routes_today(TODAY)[0]

        self.assertEqual((route['state'], route['delivered_stops'], route['last_delivery']), ('on_road', 0, None))

    def test_order_moved_to_other_route_counts_there(self):
        order = self.order(self.hotel, self.bread, 10, 'in_delivery')
        order.assigned_route = self.other_route
        order.save()

        self.assertEqual([r['route_name'] for r in routes_today(TODAY)], ['Trasa 2'])


class ProductionShiftTests(HomeTestBase):
    def setUp(self):
        super().setUp()
        self.tomorrow = TODAY + timedelta(days=1)

    def test_day_shift_bakes_for_tomorrow(self):
        self.order(self.hotel, self.bread, 10, day=self.tomorrow)
        self.order(self.shop, self.bread, 15, day=self.tomorrow)
        self.order(self.shop, self.roll, 20, day=self.tomorrow)
        StandingOrder.objects.create(
            client=self.hotel, product=self.roll, day_of_week=self.tomorrow.weekday(), quantity=7,
            price_at_sale=Decimal('1.00'),
        )

        shift = production_shift(SHIFT_NOW)

        self.assertEqual(shift['production_date'], '2026-10-20')
        self.assertEqual(shift['delivery_date'], '2026-10-21')
        self.assertFalse(shift['has_plan'])
        self.assertEqual((shift['orders'], shift['clients'], shift['pieces']), (3, 2, 45))
        self.assertEqual((shift['standing_clients'], shift['standing_pieces']), (1, 7))
        self.assertEqual(shift['products'], [{'name': 'Chleb', 'quantity': 25}, {'name': 'Bułka', 'quantity': 20}])
        self.assertEqual(shift['ingredients'], [{'name': 'Mąka', 'unit': 'kg', 'amount': '10.000'}])

    def test_night_before_cutoff_still_belongs_to_evening_shift(self):
        self.assertEqual(production_shift(NIGHT_NOW)['delivery_date'], '2026-10-21')

    def test_batches_are_counted_by_stage(self):
        plan = ProductionPlan.objects.create(delivery_date=self.tomorrow, production_date=TODAY)
        dough = Dough.objects.create(name='Ciasto pszenne')
        for sequence, stage in enumerate(['done', 'done', 'proofing'], start=1):
            ProductionBatch.objects.create(
                plan=plan, dough=dough, sequence=sequence, batch_count=3, dough_mass_kg=Decimal('20'), stage=stage,
            )

        shift = production_shift(SHIFT_NOW)

        self.assertTrue(shift['has_plan'])
        self.assertEqual(shift['stages'], {'mixing': 0, 'dividing': 0, 'proofing': 1, 'baking': 0, 'done': 2})
        self.assertEqual([b['stage'] for b in shift['batches']], ['done', 'done', 'proofing'])


class AlertTests(HomeTestBase):
    def kinds(self, user, shift=None):
        shift = shift or production_shift(SHIFT_NOW)
        return [alert['kind'] for alert in build_alerts(TODAY, shift, user.role == 'admin')]

    def test_admin_sees_every_kind_of_problem(self):
        self.order(self.shop, self.bread, 5, 'failed', day=TODAY - timedelta(days=2))
        self.order(self.shop, self.bread, 5, 'failed', day=TODAY - timedelta(days=9))
        self.order(self.hotel, self.bread, 10, day=TODAY + timedelta(days=1))
        IngredientStock.objects.create(ingredient=self.flour, current_stock=Decimal('2'), min_stock_level=Decimal('3'))

        alerts = build_alerts(TODAY, production_shift(SHIFT_NOW), True)

        self.assertEqual([a['kind'] for a in alerts], ['failed_deliveries', 'low_stock', 'missing_plan', 'day_not_closed'])
        self.assertEqual(len(alerts[0]['items']), 1)
        self.assertEqual(alerts[1]['items'], [{'name': 'Mąka', 'unit': 'kg', 'current': '2.000', 'minimum': '3.000'}])
        self.assertEqual(alerts[2]['items'], [{'date': '2026-10-21'}])

    def test_baker_does_not_get_finance_or_delivery_alerts(self):
        self.order(self.shop, self.bread, 5, 'failed', day=TODAY)

        self.assertEqual(self.kinds(self.baker), [])

    def test_quiet_day_has_no_alerts(self):
        DailyFinancialReport.objects.create(
            report_date=TODAY - timedelta(days=1), total_revenue=0, total_cogs=0,
            total_operating_expenses=0, net_profit=0, is_finalized=True,
        )
        IngredientStock.objects.create(ingredient=self.flour, current_stock=Decimal('3'), min_stock_level=Decimal('3'))

        self.assertEqual(self.kinds(self.admin), [])


class HomeApiTests(HomeTestBase):
    def setUp(self):
        super().setUp()
        self.api = APIClient()

    def test_admin_gets_finance_and_recent_changes(self):
        AuditEntry.objects.create(category='clients', action='client.updated', description='Zmieniono klienta Hotel.')
        self.api.force_authenticate(self.admin)

        data = self.api.get('/api/dashboard/home/').json()

        self.assertEqual(data['viewer'], {'full_name': 'Anna Admin', 'role': 'admin'})
        self.assertEqual(len(data['finance']['trend']), 8)
        self.assertEqual(data['recent_changes'][0]['description'], 'Zmieniono klienta Hotel.')

    def test_baker_gets_no_money(self):
        self.api.force_authenticate(self.baker)

        data = self.api.get('/api/dashboard/home/').json()

        self.assertIsNone(data['finance'])
        self.assertEqual(data['routes'], [])
        self.assertEqual(data['recent_changes'], [])
        self.assertIn('production', data)

    def test_driver_is_forbidden(self):
        self.api.force_authenticate(User.objects.get(username='driver_h'))

        self.assertEqual(self.api.get('/api/dashboard/home/').status_code, 403)