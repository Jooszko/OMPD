from datetime import date, timedelta
from decimal import Decimal

from django.db import IntegrityError
from django.test import TestCase
from rest_framework.test import APIClient

from clients.models import Client, Route
from dashboard.services.returns import last_delivery_items
from orders.models import DailyOrder, ProductReturn
from products.models import Product
from users.models import User


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



class StopReturnsViewTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.today = date.today()
        self.yesterday = self.today - timedelta(days=1)

        self.admin = User.objects.create_user(username='admin_r', password='x', role='admin', full_name='Admin R')
        self.driver = User.objects.create_user(username='driver_r', password='x', role='driver', full_name='Driver R')
        self.other_driver = User.objects.create_user(
            username='driver_r2', password='x', role='driver', full_name='Driver R2'
        )
        route = Route.objects.create(route_name='Trasa R3', driver=self.driver)
        self.shop = Client.objects.create(name='Sklep R', address='Adres R', route=route)
        self.roll = Product.objects.create(name='Bułka', category='bread', base_price=Decimal('1.00'))
        self.bread = Product.objects.create(name='Chleb', category='bread', base_price=Decimal('5.00'))

        for product, quantity, price in ((self.roll, 10, '0.90'), (self.bread, 4, '4.50')):
            DailyOrder.objects.create(
                client=self.shop, product=product, order_date=self.yesterday,
                quantity=quantity, price_at_sale=Decimal(price), status='delivered',
            )
        self.today_order = DailyOrder.objects.create(
            client=self.shop, product=self.roll, order_date=self.today,
            quantity=10, price_at_sale=Decimal('0.90'), status='in_delivery',
        )
        self.url = f'/api/logistics/clients/{self.shop.client_id}/returns/'

    def post(self, user, items, **extra):
        self.api.force_authenticate(user)
        return self.api.post(self.url, {'items': items, **extra}, format='json')

    def item(self, product, quantity):
        return {'product_id': product.product_id, 'quantity': quantity}

    def test_driver_records_return_at_price_from_last_delivery(self):
        response = self.post(self.driver, [self.item(self.roll, 3)])

        self.assertEqual(response.status_code, 200)
        saved = ProductReturn.objects.get()
        self.assertEqual(
            (saved.quantity, saved.unit_price, saved.source_date, saved.return_date, saved.recorded_by),
            (3, Decimal('0.90'), self.yesterday, self.today, self.driver),
        )
        returned = {i['product_name']: i['returned_quantity'] for i in response.data['returns']['items']}
        self.assertEqual(returned, {'Bułka': 3, 'Chleb': 0})

    def test_saving_again_replaces_previous_returns(self):
        self.post(self.driver, [self.item(self.roll, 3)])
        self.post(self.driver, [self.item(self.roll, 0), self.item(self.bread, 1)])

        self.assertEqual(list(ProductReturn.objects.values_list('product__name', 'quantity')), [('Chleb', 1)])

    def test_invalid_items_are_rejected(self):
        croissant = Product.objects.create(name='Rogal', category='bread', base_price=Decimal('2.00'))
        cases = {
            'more than delivered': [self.item(self.roll, 11)],
            'not in last delivery': [self.item(croissant, 1)],
            'negative': [self.item(self.roll, -1)],
            'duplicate product': [self.item(self.roll, 1), self.item(self.roll, 2)],
            'not a number': [{'product_id': self.roll.product_id, 'quantity': '2'}],
        }
        for name, items in cases.items():
            with self.subTest(name):
                self.assertEqual(self.post(self.driver, items).status_code, 400)
        self.assertFalse(ProductReturn.objects.exists())

    def test_driver_needs_own_stop_that_is_being_served(self):
        self.assertEqual(self.post(self.other_driver, [self.item(self.roll, 1)]).status_code, 403)

        self.today_order.status = 'failed'
        self.today_order.save()
        self.assertEqual(self.post(self.driver, [self.item(self.roll, 1)]).status_code, 400)

    def test_admin_can_correct_returns_regardless_of_stop_status(self):
        self.today_order.status = 'failed'
        self.today_order.save()

        response = self.post(self.admin, [self.item(self.bread, 2)], date=str(self.today))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(ProductReturn.objects.get().recorded_by, self.admin)

    def test_logistics_payload_includes_returns_of_stop(self):
        self.post(self.driver, [self.item(self.roll, 2)])

        self.api.force_authenticate(self.driver)
        stop = self.api.get('/api/logistics/').data['routes'][0]['stops'][0]

        self.assertEqual(stop['returns']['source_date'], str(self.yesterday))
        self.assertEqual(
            [(i['product_name'], i['delivered_quantity'], i['returned_quantity'], i['unit_price'])
             for i in stop['returns']['items']],
            [('Bułka', 10, 2, '0.90'), ('Chleb', 4, 0, '4.50')],
        )