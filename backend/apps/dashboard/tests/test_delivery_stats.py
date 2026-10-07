from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from clients.models import Client, Route
from dashboard.services.delivery_stats import build_delivery_stats
from orders.models import DailyOrder, DeliveryProof
from products.models import Product
from users.models import User


def at(day, hour):
    return timezone.make_aware(datetime.combine(day, time(hour, 0)))


class DeliveryStatsTests(TestCase):
    def setUp(self):
        self.today = date.today()
        self.day1 = self.today - timedelta(days=2)
        self.day2 = self.today - timedelta(days=1)

        self.admin = User.objects.create_user(username='admin_9', password='x', role='admin', full_name='Admin 9')
        self.driver_a = User.objects.create_user(username='driver_a9', password='x', role='driver', full_name='Anna Kierowca')
        self.driver_b = User.objects.create_user(username='driver_b9', password='x', role='driver', full_name='Bartek Kierowca')
        self.route_a = Route.objects.create(route_name='Trasa A9', driver=self.driver_a)
        route_b = Route.objects.create(route_name='Trasa B9', driver=self.driver_b)

        self.client_x = Client.objects.create(name='Sklep X', address='Adres X', route=self.route_a)
        self.client_y = Client.objects.create(name='Sklep Y', address='Adres Y', route=self.route_a)
        self.client_z = Client.objects.create(name='Sklep Z', address='Adres Z', route=route_b)
        self.product = Product.objects.create(name='Bułka', category='bread', base_price=Decimal('1.00'))

        self.make(self.client_x, self.day1, 'delivered', delivered_at=at(self.day1, 9), delivery_note='Zaplecze')
        self.make(self.client_x, self.day1, 'delivered', delivered_at=at(self.day1, 9))
        self.make(self.client_y, self.day1, 'failed', failure_reason='closed', failed_at=at(self.day1, 10))
        self.make(
            self.client_z, self.day1, 'delivered', delivered_at=at(self.day1, 11),
            assigned_route=self.route_a, assigned_driver=self.driver_a,
        )
        self.make(self.client_x, self.day2, 'planned')
        self.make(self.client_y, self.day2, 'cancelled')

        DeliveryProof.objects.create(
            client=self.client_x, order_date=self.day1, kind='photo', image='delivery_proofs/test.jpg'
        )

    def make(self, client, order_date, status, **fields):
        return DailyOrder.objects.create(
            client=client, product=self.product, order_date=order_date,
            quantity=1, price_at_sale=Decimal('1.00'), status=status, **fields,
        )

    def test_summary_counts_stops_not_orders(self):
        stats = build_delivery_stats(self.day1, self.today)

        self.assertEqual(stats['summary'], {'delivered': 2, 'failed': 1, 'pending': 1, 'success_rate': 66.7})

    def test_daily_series_covers_every_day_of_the_period(self):
        stats = build_delivery_stats(self.day1, self.today)

        self.assertEqual([d['date'] for d in stats['daily']], [str(self.day1), str(self.day2), str(self.today)])
        self.assertEqual(stats['daily'][0], {'date': str(self.day1), 'delivered': 2, 'failed': 1, 'pending': 0})
        self.assertEqual(stats['daily'][1]['pending'], 1)
        self.assertEqual(stats['daily'][2], {'date': str(self.today), 'delivered': 0, 'failed': 0, 'pending': 0})

    def test_failure_reasons_and_problem_clients(self):
        stats = build_delivery_stats(self.day1, self.today)

        self.assertEqual(stats['failure_reasons'], [{'reason': 'closed', 'label': 'Klient zamknięty', 'count': 1}])
        self.assertEqual(stats['problem_clients'], [{'client_id': self.client_y.client_id, 'name': 'Sklep Y', 'failed': 1}])

    def test_drivers_use_assignment_snapshot_and_route_times(self):
        stats = build_delivery_stats(self.day1, self.today)

        self.assertEqual(len(stats['drivers']), 1)
        anna = stats['drivers'][0]
        self.assertEqual(anna['full_name'], 'Anna Kierowca')
        self.assertEqual((anna['delivered'], anna['failed']), (2, 1))
        self.assertEqual(anna['success_rate'], 66.7)
        self.assertEqual(anna['days_on_route'], 1)
        self.assertEqual(anna['avg_stops_per_day'], 3.0)
        self.assertEqual(anna['avg_route_minutes'], 120.0)

    def test_proof_coverage_of_delivered_stops(self):
        stats = build_delivery_stats(self.day1, self.today)

        self.assertEqual(stats['proof_coverage'], {'delivered_stops': 2, 'photo': 1, 'signature': 0, 'note': 1})

    def test_empty_period_returns_no_rates(self):
        empty_day = self.today - timedelta(days=40)
        stats = build_delivery_stats(empty_day, empty_day)

        self.assertIsNone(stats['summary']['success_rate'])
        self.assertEqual(stats['drivers'], [])

    def test_view_is_admin_only_and_validates_period(self):
        api = APIClient()
        url = '/api/delivery-stats/'

        api.force_authenticate(self.driver_a)
        self.assertEqual(api.get(url).status_code, 403)

        api.force_authenticate(self.admin)
        response = api.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['period']['end'], str(self.today))
        self.assertEqual(response.data['period']['start'], str(self.today - timedelta(days=29)))

        for params in ('start=2026-13-01', f'start={self.today}&end={self.day1}', 'start=2020-01-01&end=2026-01-01'):
            with self.subTest(params=params):
                self.assertEqual(api.get(f'{url}?{params}').status_code, 400)