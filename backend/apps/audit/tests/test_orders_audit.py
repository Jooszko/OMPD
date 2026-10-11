from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from audit.models import AuditEntry
from clients.models import Client, Route
from orders.models import DailyOrder
from products.models import Product
from users.models import User

ORDER_DATE = '2026-10-12'


def change_rows(entry):
    return [(c['label'], c['old'], c['new']) for c in entry.changes]


class OrderAuditTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.baker = User.objects.create_user(username='baker_o', password='x', role='baker', full_name='Piotr Piekarz')
        self.api.force_authenticate(self.baker)
        self.shop = Client.objects.create(
            name='Sklep Pod Lipą', address='Lipowa 1', route=Route.objects.create(route_name='Trasa A')
        )
        self.bread = Product.objects.create(name='Chleb', category='bread', base_price=Decimal('4.50'))
        self.roll = Product.objects.create(name='Bułka', category='buns', base_price=Decimal('1.00'))

    def save_order(self, items, **extra):
        payload = {'client_id': self.shop.pk, 'order_date': ORDER_DATE, 'items': items, **extra}
        return self.api.post('/api/orders/daily/', payload, format='json')

    def item(self, product, qty):
        return {'product_id': product.pk, 'qty': qty}

    def test_new_order_lists_status_and_items(self):
        self.save_order([self.item(self.bread, 10)])

        entry = AuditEntry.objects.get(category='orders')
        self.assertEqual(entry.action, 'order.created')
        self.assertEqual((entry.actor, entry.object_label), (self.baker, 'Sklep Pod Lipą, 12.10.2026'))
        self.assertEqual(change_rows(entry), [('Status', None, 'Zaplanowane'), ('Chleb', None, '10 szt. × 4.50 zł')])

    def test_editing_shows_changed_and_added_items(self):
        self.save_order([self.item(self.bread, 10)])

        self.save_order([self.item(self.bread, 12), self.item(self.roll, 30)])

        entry = AuditEntry.objects.get(action='order.updated')
        self.assertEqual(change_rows(entry), [
            ('Bułka', None, '30 szt. × 1.00 zł'),
            ('Chleb', '10 szt. × 4.50 zł', '12 szt. × 4.50 zł'),
        ])

    def test_resaving_identical_order_adds_no_entry(self):
        self.save_order([self.item(self.bread, 10)])
        self.save_order([self.item(self.bread, 10)])

        self.assertEqual(AuditEntry.objects.filter(category='orders').count(), 1)

    def test_resaving_delivered_order_reveals_status_reset(self):
        self.save_order([self.item(self.bread, 10)])
        DailyOrder.objects.update(status='delivered')

        self.save_order([self.item(self.bread, 10)])

        entry = AuditEntry.objects.get(action='order.updated')
        self.assertEqual(change_rows(entry), [('Status', 'Dostarczone', 'Zaplanowane')])

    def test_deleting_order_records_what_was_ordered(self):
        self.save_order([self.item(self.bread, 10)])

        self.api.delete(f'/api/orders/daily/?id={ORDER_DATE}-{self.shop.pk}')

        entry = AuditEntry.objects.get(action='order.deleted')
        self.assertIn(('Chleb', '10 szt. × 4.50 zł', None), change_rows(entry))

    def test_standing_order_records_days_and_items(self):
        url = '/api/orders/standing/'
        self.api.post(url, {'client_id': self.shop.pk, 'days': [0, 2], 'items': [self.item(self.bread, 5)]}, format='json')
        self.api.post(
            url, {'client_id': self.shop.pk, 'days': [0, 1, 2], 'items': [self.item(self.bread, 5)]}, format='json'
        )
        self.api.delete(f'{url}?client_id={self.shop.pk}')

        created, updated, deleted = (
            AuditEntry.objects.get(action=f'standing_order.{kind}') for kind in ('created', 'updated', 'deleted')
        )
        self.assertEqual(change_rows(created), [('Dni tygodnia', None, 'Pn, Śr'), ('Chleb', None, '5 szt.')])
        self.assertEqual(change_rows(updated), [('Dni tygodnia', 'Pn, Śr', 'Pn, Wt, Śr')])
        self.assertEqual(change_rows(deleted), [('Dni tygodnia', 'Pn, Wt, Śr', None), ('Chleb', '5 szt.', None)])

    def test_unknown_product_rolls_back_order_and_entry(self):
        response = self.save_order([{'product_id': 999999, 'qty': 5}])

        self.assertEqual(response.status_code, 404)
        self.assertFalse(AuditEntry.objects.exists())