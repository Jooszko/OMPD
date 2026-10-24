from datetime import date, timedelta
from decimal import Decimal
from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from audit.models import AuditEntry
from clients.models import Client, Route
from orders.models import DailyOrder, StandingOrder
from orders.standing import create_orders_from_standing
from products.models import Product
from users.models import User

URL = '/api/orders/standing/due/'


class StandingOrdersToDailyTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(
            User.objects.create_user(username='baker_s', password='x', role='baker', full_name='Piotr Piekarz')
        )
        route = Route.objects.create(route_name='Trasa A')
        self.shop = Client.objects.create(name='Sklep', address='Lipowa 1', route=route)
        self.hotel = Client.objects.create(name='Hotel', address='Rynek 2', route=route)
        self.closed = Client.objects.create(name='Zamknięty', address='Rynek 3', route=route, is_active=False)
        self.bread = Product.objects.create(name='Chleb', category='bread', base_price=Decimal('5.00'))
        self.roll = Product.objects.create(name='Bułka', category='buns', base_price=Decimal('1.00'))
        self.day = timezone.localdate() + timedelta(days=1)
        for client in (self.shop, self.hotel, self.closed):
            self.standing(client, self.bread, 10, self.day.weekday())
            self.standing(client, self.roll, 40, self.day.weekday())
        self.standing(self.shop, self.bread, 99, (self.day.weekday() + 1) % 7)

    def standing(self, client, product, quantity, day_of_week):
        return StandingOrder.objects.create(
            client=client, product=product, day_of_week=day_of_week, quantity=quantity,
            price_at_sale=Decimal('4.20'),
        )

    def test_creates_orders_only_for_active_clients_without_an_order(self):
        DailyOrder.objects.create(
            client=self.hotel, product=self.roll, order_date=self.day, quantity=5, price_at_sale=Decimal('1.00'),
        )

        created = create_orders_from_standing(self.day)

        self.assertEqual(len(created), 2)
        orders = DailyOrder.objects.filter(client=self.shop, order_date=self.day)
        self.assertEqual(
            sorted(orders.values_list('product__name', 'quantity', 'price_at_sale', 'status')),
            [('Bułka', 40, Decimal('4.20'), 'planned'), ('Chleb', 10, Decimal('4.20'), 'planned')],
        )
        self.assertEqual(DailyOrder.objects.filter(client=self.hotel).count(), 1)
        self.assertFalse(DailyOrder.objects.filter(client=self.closed).exists())
        self.assertEqual(create_orders_from_standing(self.day), [])

    def test_preview_lists_clients_still_missing_an_order(self):
        response = self.api.get(f'{URL}?date={self.day.isoformat()}')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [(c['client_name'], c['items'], c['total_quantity']) for c in response.json()['clients']],
            [('Hotel', 2, 50), ('Sklep', 2, 50)],
        )

    def test_creating_from_the_api_is_logged_once(self):
        response = self.api.post(URL, {'date': self.day.isoformat()}, format='json')

        data = response.json()
        self.assertEqual(response.status_code, 201)
        self.assertEqual((data['created_clients'], data['created_items'], data['clients']), (2, 4, []))
        entry = AuditEntry.objects.get(action='order.created_from_standing')
        self.assertEqual([c['label'] for c in entry.changes], ['Hotel', 'Sklep'])

    def test_past_days_are_refused(self):
        yesterday = timezone.localdate() - timedelta(days=1)

        response = self.api.post(URL, {'date': yesterday.isoformat()}, format='json')

        self.assertEqual(response.status_code, 409)
        self.assertFalse(DailyOrder.objects.exists())

    def test_command_creates_tomorrow_and_skips_holidays(self):
        out = StringIO()
        call_command('create_standing_orders', stdout=out)

        self.assertEqual(DailyOrder.objects.filter(order_date=self.day).count(), 4)
        self.assertEqual(AuditEntry.objects.get().actor_name, 'System (zamówienia stałe)')

        call_command('create_standing_orders', '--date', '2026-11-11', stdout=out)
        self.assertFalse(DailyOrder.objects.filter(order_date=date(2026, 11, 11)).exists())