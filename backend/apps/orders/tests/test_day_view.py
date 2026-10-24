from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from clients.models import Client, Route
from dashboard.seed.production import create_production_setup
from dashboard.seed.products import create_ingredients, create_products
from orders.day import stop_status
from orders.models import DailyOrder, StandingOrder
from production.services.planning import generate_plan
from users.models import User


class StopStatusTests(TestCase):
    def test_the_least_advanced_active_status_wins(self):
        self.assertEqual(stop_status({'delivered', 'failed'}), 'failed')
        self.assertEqual(stop_status({'planned', 'in_production'}), 'in_production')
        self.assertEqual(stop_status({'delivered', 'cancelled'}), 'delivered')
        self.assertEqual(stop_status({'cancelled'}), 'cancelled')


class OrderDayViewTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.baker = User.objects.create_user(username='baker_v', password='x', role='baker', full_name='Piotr Piekarz')
        self.api.force_authenticate(self.baker)
        driver = User.objects.create_user(username='driver_v', password='x', role='driver', full_name='Jan Kierowca')
        self.north = Route.objects.create(route_name='Trasa Północ', driver=driver)
        self.south = Route.objects.create(route_name='Trasa Południe')
        self.shop = Client.objects.create(name='Sklep', address='Lipowa 1', route=self.north)
        self.hotel = Client.objects.create(name='Hotel', address='Rynek 2', route=self.north)
        self.cafe = Client.objects.create(name='Kawiarnia', address='Rynek 3', route=self.south)
        products = create_products(create_ingredients())
        self.bread, self.roll = products['Chleb pszenny 500g'], products['Bułka pszenna']
        self.products = products
        self.day = timezone.localdate() + timedelta(days=1)

    def order(self, client, product, quantity, status='planned', day=None):
        return DailyOrder.objects.create(
            client=client, product=product, order_date=day or self.day, quantity=quantity,
            price_at_sale=Decimal('2.00'), status=status,
        )

    def get_day(self, day=None):
        return self.api.get(f'/api/orders/day/?date={(day or self.day).isoformat()}').json()

    def test_groups_stops_by_route_with_totals(self):
        self.order(self.shop, self.bread, 10)
        self.order(self.shop, self.roll, 50)
        self.order(self.hotel, self.roll, 20, status='cancelled')
        moved = self.order(self.cafe, self.bread, 5)
        moved.assigned_route = self.north
        moved.save()
        StandingOrder.objects.create(
            client=self.shop, product=self.bread, day_of_week=self.day.weekday(), quantity=10,
            price_at_sale=Decimal('2.00'),
        )

        data = self.get_day()

        self.assertEqual([r['route_name'] for r in data['routes']], ['Trasa Północ'])
        route = data['routes'][0]
        self.assertEqual((route['driver_name'], route['total_quantity'], route['total_amount']), ('Jan Kierowca', 65, 130.0))
        stops = {stop['client_name']: stop for stop in route['stops']}
        self.assertEqual(stops['Sklep']['total_quantity'], 60)
        self.assertTrue(stops['Sklep']['is_standing'])
        self.assertEqual(stops['Hotel']['status'], 'cancelled')
        self.assertEqual(data['summary']['stops'], 2)
        self.assertEqual((data['summary']['pieces'], data['summary']['value']), (65, 130.0))
        self.assertEqual(
            [(row['product_name'], row['quantity']) for row in data['products']],
            [('Bułka pszenna', 50), ('Chleb pszenny 500g', 15)],
        )

    def test_marks_stops_that_can_no_longer_change(self):
        self.order(self.shop, self.bread, 10, status='delivered')
        self.order(self.cafe, self.bread, 10)
        yesterday = timezone.localdate() - timedelta(days=1)
        self.order(self.hotel, self.bread, 10, day=yesterday)

        stops = {s['client_name']: s for r in self.get_day()['routes'] for s in r['stops']}
        past = self.get_day(yesterday)

        self.assertEqual((stops['Sklep']['locked'], stops['Kawiarnia']['locked']), (True, False))
        self.assertTrue(past['is_past'])
        self.assertTrue(past['routes'][0]['stops'][0]['locked'])
        self.assertIsNone(past['standing_due'])

    def test_counts_standing_orders_still_missing(self):
        StandingOrder.objects.create(
            client=self.hotel, product=self.roll, day_of_week=self.day.weekday(), quantity=30,
            price_at_sale=Decimal('1.00'),
        )

        self.assertEqual(self.get_day()['standing_due'], {'clients': 1, 'items': 1})

    def test_reports_order_changes_after_the_plan_was_generated(self):
        create_production_setup(create_ingredients(), self.products)
        bread = self.order(self.shop, self.bread, 10)
        self.assertIsNone(self.get_day()['plan'])
        generate_plan(self.day, self.baker)

        bread.quantity = 14
        bread.save()

        plan = self.get_day()['plan']
        self.assertEqual(
            [(c['product_name'], c['planned_qty'], c['current_qty']) for c in plan['changes']],
            [('Chleb pszenny 500g', 10, 14)],
        )

    def test_route_lists_stops_in_driving_order(self):
        far = Client.objects.create(name='Apteka', address='Rynek 4', route=self.south, phone='600100200',
                                    latitude=Decimal('49.80'), longitude=Decimal('18.70'))
        end = Client.objects.create(name='Bar', address='Rynek 5', route=self.south,
                                    latitude=Decimal('49.80'), longitude=Decimal('18.90'))
        middle = Client.objects.create(name='Cukiernia', address='Rynek 6', route=self.south,
                                       latitude=Decimal('49.80'), longitude=Decimal('18.80'))
        for client in (far, end, middle, self.cafe):
            self.order(client, self.bread, 5)

        route = self.get_day()['routes'][0]

        self.assertEqual(route['driving_order'], [far.pk, middle.pk, end.pk, self.cafe.pk])
        self.assertEqual(route['stops'][0]['phone'], '600100200')
        self.assertNotIn('point', route['stops'][0])