from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from clients.models import Client, Route
from finance.views import _returns_for_date, _revenue_for_date
from orders.models import DailyOrder, ProductReturn
from products.models import Product
from users.models import User


class RevenueStatusTests(TestCase):
    def setUp(self):
        route = Route.objects.create(route_name='Trasa Fin')
        client = Client.objects.create(name='Klient Fin', address='Adres Fin', route=route)
        product = Product.objects.create(name='Chleb Fin', category='bread', base_price=Decimal('10.00'))
        self.today = date.today()

        for status in ('delivered', 'in_delivery', 'failed', 'cancelled'):
            DailyOrder.objects.create(
                client=client, product=product, order_date=self.today,
                quantity=1, price_at_sale=Decimal('10.00'), status=status,
            )

    def test_failed_and_cancelled_orders_are_not_revenue(self):
        self.assertEqual(_revenue_for_date(self.today), Decimal('20.00'))


class ReturnsInFinanceTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(
            User.objects.create_user(username='admin_fin', password='x', role='admin', full_name='Admin Fin')
        )
        self.today = date.today()
        self.yesterday = self.today - timedelta(days=1)
        route = Route.objects.create(route_name='Trasa Zwroty')
        self.shop = Client.objects.create(name='Sklep Zwrot', address='Adres 1', route=route)
        other = Client.objects.create(name='Sklep Inny', address='Adres 2', route=route)
        product = Product.objects.create(name='Bułka Fin', category='bread', base_price=Decimal('1.00'))

        for client, quantity in ((self.shop, 10), (other, 9)):
            DailyOrder.objects.create(
                client=client, product=product, order_date=self.today,
                quantity=quantity, price_at_sale=Decimal('3.00'), status='delivered',
            )
        ProductReturn.objects.create(
            client=self.shop, product=product, return_date=self.today, source_date=self.yesterday,
            quantity=4, unit_price=Decimal('2.50'),
        )

    def test_returns_reduce_revenue_on_return_date(self):
        self.assertEqual(_returns_for_date(self.today), Decimal('10.00'))
        self.assertEqual(_revenue_for_date(self.today), Decimal('47.00'))
        self.assertEqual(_revenue_for_date(self.yesterday), Decimal('0'))

    def test_daily_summary_breaks_down_sales_and_returns(self):
        data = self.api.get('/api/finance/daily-summary/').data

        self.assertEqual(
            (data['sales'], data['returns'], data['revenue'], data['balance']),
            ('57.00', '10.00', '47.00', '47.00'),
        )

    def test_period_incomes_list_returns_as_negative_rows(self):
        rows = self.api.get('/api/finance/period-incomes/').data

        self.assertIn(
            {'client_name': 'Sklep Zwrot', 'amount': '-10.00', 'date': str(self.today), 'kind': 'return'}, rows
        )
        self.assertEqual(sum(Decimal(r['amount']) for r in rows), Decimal('47.00'))

    def test_top_clients_are_ranked_after_returns(self):
        rows = self.api.get('/api/finance/top-clients/').data

        self.assertEqual(
            [(r['client_name'], r['total']) for r in rows],
            [('Sklep Inny', '27.00'), ('Sklep Zwrot', '20.00')],
        )