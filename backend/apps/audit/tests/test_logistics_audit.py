import shutil
import tempfile
from datetime import date, timedelta
from decimal import Decimal
from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from audit.models import AuditEntry
from clients.models import Client, Route
from orders.models import DailyOrder
from products.models import Product
from users.models import User

TEMP_MEDIA_ROOT = tempfile.mkdtemp()


def change_rows(entry):
    return [(c['label'], c['old'], c['new']) for c in entry.changes]


def make_image_file():
    buffer = BytesIO()
    Image.new('RGB', (20, 20), color=(200, 150, 50)).save(buffer, format='JPEG')
    return SimpleUploadedFile('proof.jpg', buffer.getvalue(), content_type='image/jpeg')


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class LogisticsAuditTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.api = APIClient()
        self.admin = User.objects.create_user(username='admin_l', password='x', role='admin', full_name='Anna Admin')
        self.driver = User.objects.create_user(username='driver_l', password='x', role='driver', full_name='Jan Kierowca')
        route = Route.objects.create(route_name='Trasa L', driver=self.driver)
        self.shop = Client.objects.create(name='Sklep Pod Lipą', address='Lipowa 1', route=route)
        self.bread = Product.objects.create(name='Chleb', category='bread', base_price=Decimal('5.00'))
        self.roll = Product.objects.create(name='Bułka', category='bread', base_price=Decimal('1.00'))
        today = date.today()
        self.bread_order = DailyOrder.objects.create(
            client=self.shop, product=self.bread, order_date=today,
            quantity=10, price_at_sale=Decimal('5.00'), status='in_delivery',
        )
        self.roll_order = DailyOrder.objects.create(
            client=self.shop, product=self.roll, order_date=today,
            quantity=5, price_at_sale=Decimal('1.00'), status='in_delivery',
        )
        DailyOrder.objects.create(
            client=self.shop, product=self.bread, order_date=today - timedelta(days=1),
            quantity=8, price_at_sale=Decimal('5.00'), status='delivered',
        )
        self.stop_url = f'/api/logistics/clients/{self.shop.client_id}'
        self.label = f'Sklep Pod Lipą, {today:%d.%m.%Y}'

    def as_driver(self):
        self.api.force_authenticate(self.driver)

    def test_delivering_stop_creates_one_entry_for_all_orders(self):
        self.as_driver()

        self.api.post(f'{self.stop_url}/deliver/')

        entry = AuditEntry.objects.get(action='stop.delivered')
        self.assertEqual(AuditEntry.objects.filter(category='logistics').count(), 1)
        self.assertEqual(entry.actor, self.driver)
        self.assertEqual(entry.object_label, self.label)
        self.assertIn('Chleb x10', entry.description)
        self.assertIn('Bułka x5', entry.description)
        self.assertEqual(change_rows(entry), [('Status', 'W dostawie', 'Dostarczone')])

    def test_single_status_change_is_logged_only_when_status_differs(self):
        self.api.force_authenticate(self.admin)
        url = f'/api/logistics/orders/{self.bread_order.pk}/status/'

        self.api.patch(url, {'status': 'delivered'}, format='json')
        self.api.patch(url, {'status': 'delivered'}, format='json')

        entry = AuditEntry.objects.get(action='order.status_changed')
        self.assertIn('Chleb x10', entry.description)
        self.assertEqual(change_rows(entry), [('Status', 'W dostawie', 'Dostarczone')])

    def test_reported_and_withdrawn_problem_are_both_logged(self):
        self.as_driver()

        self.api.post(f'{self.stop_url}/report-problem/', {'reason': 'closed'}, format='json')
        self.api.post(
            '/api/logistics/problems/withdraw/',
            {'order_ids': [self.bread_order.pk, self.roll_order.pk]},
            format='json',
        )

        failed = AuditEntry.objects.get(action='delivery.failed')
        withdrawn = AuditEntry.objects.get(action='delivery.problem_withdrawn')
        self.assertIn('Klient zamknięty', failed.description)
        self.assertEqual(change_rows(failed), [('Status', 'W dostawie', 'Nieudana dostawa')])
        self.assertEqual(change_rows(withdrawn), [('Status', 'Nieudana dostawa', 'W dostawie')])

    def test_delivery_note_is_logged_only_when_changed(self):
        self.as_driver()
        self.api.post(f'{self.stop_url}/deliver/')

        self.api.post(f'{self.stop_url}/delivery-note/', {'note': 'Zostawione na zapleczu'}, format='json')
        self.api.post(f'{self.stop_url}/delivery-note/', {'note': 'Zostawione na zapleczu'}, format='json')

        entry = AuditEntry.objects.get(action='stop.note_changed')
        self.assertEqual(change_rows(entry), [('Notatka', '', 'Zostawione na zapleczu')])

    def test_returns_show_added_and_removed_products(self):
        self.as_driver()

        self.api.post(f'{self.stop_url}/returns/', {'items': [{'product_id': self.bread.pk, 'quantity': 2}]}, format='json')
        self.api.post(f'{self.stop_url}/returns/', {'items': []}, format='json')

        added, removed = AuditEntry.objects.filter(action='returns.updated').order_by('entry_id')
        self.assertEqual(change_rows(added), [('Chleb', None, '2 szt.')])
        self.assertEqual(change_rows(removed), [('Chleb', '2 szt.', None)])

    def test_proof_added_replaced_and_deleted(self):
        self.as_driver()
        self.api.post(f'{self.stop_url}/deliver/')

        self.api.post(f'{self.stop_url}/proofs/', {'kind': 'photo', 'image': make_image_file()}, format='multipart')
        response = self.api.post(
            f'{self.stop_url}/proofs/', {'kind': 'photo', 'image': make_image_file()}, format='multipart'
        )
        self.api.delete(f'/api/logistics/proofs/{response.data["proof_id"]}/')

        actions = list(
            AuditEntry.objects.filter(action__startswith='proof.').order_by('entry_id').values_list('action', flat=True)
        )
        self.assertEqual(actions, ['proof.added', 'proof.replaced', 'proof.deleted'])
        self.assertIn('zdjęcie', AuditEntry.objects.get(action='proof.deleted').description)