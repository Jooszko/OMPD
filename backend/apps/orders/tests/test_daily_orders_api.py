from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from clients.models import Client, Route
from orders.models import DailyOrder
from products.models import Product
from users.models import User

URL = '/api/orders/daily/'


class DailyOrderEditingTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(
            User.objects.create_user(username='baker_d', password='x', role='baker', full_name='Piotr Piekarz')
        )
        self.route = Route.objects.create(route_name='Trasa A')
        self.other_route = Route.objects.create(route_name='Trasa B')
        self.shop = Client.objects.create(name='Sklep', address='Lipowa 1', route=self.route)
        self.bread = Product.objects.create(name='Chleb', category='bread', base_price=Decimal('4.50'))
        self.roll = Product.objects.create(name='Bułka', category='buns', base_price=Decimal('1.00'))
        self.cake = Product.objects.create(name='Sernik', category='pastry', base_price=Decimal('6.00'))
        self.day = timezone.localdate() + timedelta(days=1)

    def save(self, items, day=None, **extra):
        payload = {
            'client_id': self.shop.pk,
            'order_date': (day or self.day).isoformat(),
            'items': [{'product_id': product.pk, 'qty': qty} for product, qty in items],
            **extra,
        }
        return self.api.post(URL, payload, format='json')

    def order(self, product, quantity, status='planned', day=None):
        return DailyOrder.objects.create(
            client=self.shop, product=product, order_date=day or self.day, quantity=quantity,
            price_at_sale=product.base_price, status=status,
        )

    def test_editing_changes_only_the_items(self):
        bread = self.order(self.bread, 10, status='in_production')
        self.order(self.roll, 30, status='in_production')
        DailyOrder.objects.update(assigned_route=self.other_route)
        self.bread.base_price = Decimal('5.00')
        self.bread.save()

        response = self.save([(self.bread, 12), (self.cake, 4)], status='planned')

        self.assertEqual(response.status_code, 201)
        bread.refresh_from_db()
        self.assertEqual((bread.quantity, bread.price_at_sale, bread.status), (12, Decimal('4.50'), 'in_production'))
        self.assertFalse(DailyOrder.objects.filter(product=self.roll).exists())
        cake = DailyOrder.objects.get(product=self.cake)
        self.assertEqual((cake.status, cake.assigned_route), ('in_production', self.other_route))

    def test_new_order_is_planned(self):
        self.save([(self.bread, 10)], status='delivered')

        self.assertEqual(DailyOrder.objects.get().status, 'planned')

    def test_order_on_the_road_or_delivered_cannot_be_changed_or_deleted(self):
        self.order(self.bread, 10, status='delivered')
        self.order(self.roll, 30)

        saved = self.save([(self.bread, 99)])
        deleted = self.api.delete(f'{URL}?id={self.day.isoformat()}-{self.shop.pk}')

        self.assertEqual((saved.status_code, deleted.status_code), (409, 409))
        self.assertEqual(DailyOrder.objects.get(product=self.bread).quantity, 10)
        self.assertEqual(DailyOrder.objects.count(), 2)

    def test_past_orders_are_read_only(self):
        yesterday = timezone.localdate() - timedelta(days=1)
        self.order(self.bread, 10, day=yesterday)

        saved = self.save([(self.bread, 5)], day=yesterday)
        deleted = self.api.delete(f'{URL}?id={yesterday.isoformat()}-{self.shop.pk}')

        self.assertEqual((saved.status_code, deleted.status_code), (409, 409))
        self.assertEqual(DailyOrder.objects.get().quantity, 10)

    def test_future_order_can_be_deleted(self):
        self.order(self.bread, 10, status='in_production')

        response = self.api.delete(f'{URL}?id={self.day.isoformat()}-{self.shop.pk}')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(DailyOrder.objects.exists())

    def test_malformed_or_empty_items_are_rejected(self):
        self.order(self.bread, 10)

        malformed = self.api.post(
            URL, {'client_id': self.shop.pk, 'order_date': self.day.isoformat(), 'items': [{'qty': 'dużo'}]},
            format='json',
        )
        empty = self.save([(self.bread, 0)])

        self.assertEqual((malformed.status_code, empty.status_code), (400, 400))
        self.assertEqual(DailyOrder.objects.get().quantity, 10)