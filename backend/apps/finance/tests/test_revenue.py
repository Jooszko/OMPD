from datetime import date
from decimal import Decimal

from django.test import TestCase

from clients.models import Client, Route
from finance.views import _revenue_for_date
from orders.models import DailyOrder
from products.models import Product


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