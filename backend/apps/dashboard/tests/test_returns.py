from datetime import date, timedelta
from decimal import Decimal

from django.db import IntegrityError
from django.test import TestCase

from clients.models import Client, Route
from dashboard.services.returns import last_delivery_items
from orders.models import DailyOrder, ProductReturn
from products.models import Product


class LastDeliveryItemsTests(TestCase):
    def setUp(self):
        self.today = date.today()
        route = Route.objects.create(route_name='Trasa R1')
        self.client_a = Client.objects.create(name='Sklep A', address='Adres A', route=route)
        self.client_b = Client.objects.create(name='Sklep B', address='Adres B', route=route)
        self.bread = Product.objects.create(name='Chleb', category='bread', base_price=Decimal('5.00'))
        self.roll = Product.objects.create(name='Bułka', category='bread', base_price=Decimal('1.00'))

    def make(self, client, product, days_ago, quantity, status='delivered', price='1.00'):
        return DailyOrder.objects.create(
            client=client, product=product, order_date=self.today - timedelta(days=days_ago),
            quantity=quantity, price_at_sale=Decimal(price), status=status,
        )

    def test_uses_only_the_latest_earlier_delivery_and_sums_products(self):
        self.make(self.client_a, self.bread, 3, 8, price='4.50')
        self.make(self.client_a, self.roll, 1, 10, price='0.90')
        self.make(self.client_a, self.roll, 1, 5, price='0.90')
        self.make(self.client_a, self.bread, 0, 4)

        result = last_delivery_items([self.client_a.client_id], self.today)

        self.assertEqual(result[self.client_a.client_id], {
            'source_date': self.today - timedelta(days=1),
            'items': [{
                'product_id': self.roll.product_id,
                'product_name': 'Bułka',
                'quantity': 15,
                'unit_price': Decimal('0.90'),
            }],
        })

    def test_failed_and_cancelled_orders_are_not_returnable(self):
        self.make(self.client_a, self.bread, 2, 6, price='4.50')
        self.make(self.client_a, self.roll, 1, 10, status='failed')
        self.make(self.client_a, self.roll, 1, 3, status='cancelled')

        result = last_delivery_items([self.client_a.client_id], self.today)

        self.assertEqual(result[self.client_a.client_id]['source_date'], self.today - timedelta(days=2))
        self.assertEqual([i['product_name'] for i in result[self.client_a.client_id]['items']], ['Chleb'])

    def test_each_client_gets_their_own_last_delivery(self):
        self.make(self.client_a, self.bread, 1, 2)
        self.make(self.client_a, self.roll, 2, 7)
        self.make(self.client_b, self.roll, 2, 9)

        result = last_delivery_items([self.client_a.client_id, self.client_b.client_id], self.today)

        self.assertEqual([i['product_name'] for i in result[self.client_a.client_id]['items']], ['Chleb'])
        self.assertEqual(result[self.client_b.client_id]['items'][0]['quantity'], 9)

    def test_client_without_earlier_delivery_is_left_out(self):
        self.make(self.client_a, self.bread, 0, 4)

        self.assertEqual(last_delivery_items([self.client_a.client_id], self.today), {})


class ProductReturnModelTests(TestCase):
    def setUp(self):
        route = Route.objects.create(route_name='Trasa R2')
        self.client_a = Client.objects.create(name='Sklep A', address='Adres A', route=route)
        self.roll = Product.objects.create(name='Bułka', category='bread', base_price=Decimal('1.00'))

    def make_return(self, quantity=2):
        return ProductReturn.objects.create(
            client=self.client_a, product=self.roll, return_date=date.today(),
            source_date=date.today() - timedelta(days=1), quantity=quantity, unit_price=Decimal('0.90'),
        )

    def test_one_entry_per_product_client_and_day(self):
        self.make_return()
        with self.assertRaises(IntegrityError):
            self.make_return()

    def test_quantity_must_be_positive(self):
        with self.assertRaises(IntegrityError):
            self.make_return(quantity=0)