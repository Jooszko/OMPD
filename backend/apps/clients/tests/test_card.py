from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from clients.models import Client, Route
from clients.services.card import client_card
from orders.models import DailyOrder, ProductReturn, StandingOrder
from products.models import Product
from users.models import User

TODAY = date(2026, 10, 18)


class ClientCardTests(TestCase):
    def setUp(self):
        self.route = Route.objects.create(route_name='Trasa 4')
        self.client_obj = Client.objects.create(name='Kawiarnia', address='Leśna 22, Brenna', route=self.route)
        self.bread = Product.objects.create(name='Chleb słonecznikowy', category='bread', base_price=Decimal('6.20'))
        self.roll = Product.objects.create(name='Bułka pszenna', category='bread', base_price=Decimal('0.80'))

    def order(self, days_ago, quantity, status='delivered', product=None):
        return DailyOrder.objects.create(
            client=self.client_obj, product=product or self.bread, order_date=TODAY - timedelta(days=days_ago),
            quantity=quantity, price_at_sale=Decimal('2.00'), status=status,
        )

    def test_standing_orders_are_sorted_by_day_and_skip_inactive(self):
        StandingOrder.objects.create(client=self.client_obj, product=self.bread, day_of_week=6, quantity=15, price_at_sale=Decimal('6.20'))
        StandingOrder.objects.create(client=self.client_obj, product=self.roll, day_of_week=0, quantity=20, price_at_sale=Decimal('0.80'))
        StandingOrder.objects.create(
            client=self.client_obj, product=self.roll, day_of_week=3, quantity=5, price_at_sale=Decimal('0.80'), is_active=False
        )

        standing = client_card(self.client_obj, TODAY)['standing_orders']

        self.assertEqual(
            [(s['day_of_week'], s['product_name'], s['quantity'], s['price']) for s in standing],
            [(0, 'Bułka pszenna', 20, '0.80'), (6, 'Chleb słonecznikowy', 15, '6.20')],
        )

    def test_last_30_days_count_sales_delivery_days_and_returns(self):
        self.order(0, 5, status='planned')
        self.order(1, 10)
        self.order(1, 2, product=self.roll)
        self.order(2, 3, status='failed')
        self.order(3, 4, status='cancelled')
        self.order(30, 50)
        ProductReturn.objects.create(
            client=self.client_obj, product=self.bread, return_date=TODAY - timedelta(days=1),
            source_date=TODAY - timedelta(days=2), quantity=1, unit_price=Decimal('2.00'),
        )

        stats = client_card(self.client_obj, TODAY)['last_30_days']

        self.assertEqual(stats['sales'], '34.00')
        self.assertEqual((stats['delivered_days'], stats['planned_days']), (1, 3))
        self.assertEqual(stats['returns'], '2.00')

    def test_recent_deliveries_group_products_by_day_newest_first(self):
        self.order(0, 5, status='planned')
        self.order(1, 10)
        self.order(1, 2, status='failed', product=self.roll)
        self.order(3, 4, status='cancelled')

        recent = client_card(self.client_obj, TODAY)['recent_deliveries']

        self.assertEqual(
            [(r['date'], r['value'], r['status']) for r in recent],
            [('2026-10-18', '10.00', 'planned'), ('2026-10-17', '24.00', 'delivered'), ('2026-10-15', '8.00', 'cancelled')],
        )
        self.assertEqual(recent[1]['status_label'], 'Dostarczone')

    def test_only_six_latest_days_are_listed(self):
        for days_ago in range(10):
            self.order(days_ago, 1)

        self.assertEqual(len(client_card(self.client_obj, TODAY)['recent_deliveries']), 6)


class ClientDetailApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = User.objects.create_user(username='admin_c', password='x', role='admin', full_name='Admin C')
        self.baker = User.objects.create_user(username='baker_c', password='x', role='baker', full_name='Baker C')
        self.driver = User.objects.create_user(username='driver_c', password='x', role='driver', full_name='Jan Kierowca')
        route = Route.objects.create(route_name='Trasa 1', driver=self.driver)
        self.client_obj = Client.objects.create(name='Sklep', address='Rynek 1, Skoczów', route=route)
        product = Product.objects.create(name='Chleb', category='bread', base_price=Decimal('5.00'))
        StandingOrder.objects.create(client=self.client_obj, product=product, day_of_week=4, quantity=3, price_at_sale=Decimal('5.00'))

    def test_admin_gets_client_with_card_data(self):
        self.api.force_authenticate(self.admin)

        data = self.api.get(f'/api/clients/{self.client_obj.pk}/').data

        self.assertEqual(data['name'], 'Sklep')
        self.assertEqual(data['route_details']['driver_name'], 'Jan Kierowca')
        self.assertEqual(data['standing_days'], [4])
        self.assertIn('last_30_days', data)
        self.assertIn('recent_deliveries', data)

    def test_baker_cannot_open_the_card(self):
        self.api.force_authenticate(self.baker)

        self.assertEqual(self.api.get(f'/api/clients/{self.client_obj.pk}/').status_code, 403)

    def test_list_shows_standing_days_and_driver(self):
        self.api.force_authenticate(self.admin)

        row = self.api.get('/api/clients/').data[0]

        self.assertEqual(row['standing_days'], [4])
        self.assertEqual(row['route_details']['driver_name'], 'Jan Kierowca')