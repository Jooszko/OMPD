from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from clients.models import Client, Route
from orders.models import DailyOrder
from products.models import Product
from users.models import User

URL = '/api/orders/history/'
DAY = date(2026, 9, 15)


class OrderHistoryTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(User.objects.create_user(username='b', password='x', role='baker', full_name='B'))
        route = Route.objects.create(route_name='Trasa 1')
        self.shop = Client.objects.create(name='Sklep "Złoty Kłos"', address='Rynek 1', route=route)
        self.hotel = Client.objects.create(name='Hotel', address='Rynek 2', route=route)
        self.bread = Product.objects.create(name='Chleb', category='bread', base_price=Decimal('5.00'))
        self.roll = Product.objects.create(name='Bułka', category='buns', base_price=Decimal('1.00'))

    def order(self, client, product, quantity, day=DAY, status='delivered'):
        return DailyOrder.objects.create(
            client=client, product=product, order_date=day, quantity=quantity, price_at_sale=product.base_price, status=status,
        )

    def get(self, **params):
        query = '&'.join(f'{key}={value}' for key, value in {'date_from': '2026-09-01', 'date_to': '2026-09-30', **params}.items())
        return self.api.get(f'{URL}?{query}')

    def test_groups_lines_into_stops_newest_first(self):
        self.order(self.shop, self.bread, 10)
        self.order(self.shop, self.roll, 30, status='failed')
        self.order(self.hotel, self.roll, 20, day=DAY + timedelta(days=1))

        data = self.get().json()

        self.assertEqual([(r['date'], r['client_name']) for r in data['results']], [
            ('2026-09-16', 'Hotel'), ('2026-09-15', 'Sklep "Złoty Kłos"'),
        ])
        shop = data['results'][1]
        self.assertEqual((shop['status'], shop['total_quantity'], shop['total_amount'], len(shop['items'])), ('failed', 10, 50.0, 2))
        self.assertEqual(data['summary'], {'stops': 2, 'pieces': 30, 'value': 70.0})

    def test_paginates_stops(self):
        for offset in range(30):
            self.order(self.shop, self.bread, 1, day=date(2026, 9, 1) + timedelta(days=offset % 30))

        first = self.get().json()
        second = self.get(page=2).json()

        self.assertEqual((first['count'], first['pages'], len(first['results'])), (30, 2, 25))
        self.assertEqual((second['page'], len(second['results'])), (2, 5))
        self.assertEqual(self.get(page=9).json()['page'], 2)

    def test_filters_by_client_status_and_dates(self):
        self.order(self.shop, self.bread, 10)
        self.order(self.hotel, self.bread, 10, status='failed')
        self.order(self.hotel, self.bread, 10, day=date(2026, 8, 30))

        self.assertEqual([r['client_name'] for r in self.get(q='złoty').json()['results']], ['Sklep "Złoty Kłos"'])
        self.assertEqual([r['client_name'] for r in self.get(status='failed').json()['results']], ['Hotel'])
        self.assertEqual(self.get(date_from='2026-08-01', date_to='2026-08-31').json()['count'], 1)

    def test_default_range_is_the_last_thirty_days_before_today(self):
        today = timezone.localdate()
        self.order(self.shop, self.bread, 1, day=today)
        self.order(self.shop, self.bread, 1, day=today - timedelta(days=1))
        self.order(self.shop, self.bread, 1, day=today - timedelta(days=31))

        data = self.api.get(URL).json()

        self.assertEqual([r['date'] for r in data['results']], [str(today - timedelta(days=1))])

    def test_rejects_bad_filters(self):
        self.assertEqual(self.get(date_from='wczoraj').status_code, 400)
        self.assertEqual(self.get(date_from='2026-09-30', date_to='2026-09-01').status_code, 400)
        self.assertEqual(self.get(status='zgubione').status_code, 400)
        self.assertEqual(self.get(status='planned').status_code, 400)

    def test_open_lists_past_orders_nobody_closed(self):
        self.order(self.shop, self.bread, 10)
        self.order(self.hotel, self.bread, 10, status='in_delivery')
        self.order(self.hotel, self.roll, 10, day=DAY + timedelta(days=1), status='planned')

        data = self.get(status='open').json()

        self.assertEqual([(r['date'], r['client_name']) for r in data['results']], [
            ('2026-09-16', 'Hotel'), ('2026-09-15', 'Hotel'),
        ])