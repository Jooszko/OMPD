import shutil
import tempfile
from datetime import date, timedelta
from decimal import Decimal
from io import BytesIO
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from clients.models import Client, Route
from orders.models import DailyOrder, DeliveryProof
from products.models import Product
from users.models import User

TEMP_MEDIA_ROOT = tempfile.mkdtemp()


def make_image_file(name='proof.jpg', image_format='JPEG'):
    buffer = BytesIO()
    Image.new('RGB', (20, 20), color=(200, 150, 50)).save(buffer, format=image_format)
    return SimpleUploadedFile(name, buffer.getvalue(), content_type=f'image/{image_format.lower()}')


class ProofTestBase(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.api = APIClient()
        self.admin = User.objects.create_user(
            username='admin_7', password='x', role='admin', full_name='Admin 7'
        )
        self.driver_a = User.objects.create_user(
            username='driver_a7', password='x', role='driver', full_name='Driver A7'
        )
        self.driver_b = User.objects.create_user(
            username='driver_b7', password='x', role='driver', full_name='Driver B7'
        )
        route_a = Route.objects.create(route_name='Trasa A7', driver=self.driver_a)
        self.client_a = Client.objects.create(name='Klient A7', address='Adres A7', route=route_a)
        product = Product.objects.create(name='Pączek', category='bread', base_price=Decimal('2.50'))
        self.order = DailyOrder.objects.create(
            client=self.client_a, product=product, order_date=date.today(),
            quantity=10, price_at_sale=Decimal('2.50'), status='delivered', delivered_at=timezone.now(),
        )
        self.url = f'/api/logistics/clients/{self.client_a.client_id}/proofs/'

    def upload(self, user, **data):
        self.api.force_authenticate(user)
        return self.api.post(self.url, data, format='multipart')

    def make_proof(self, uploaded_by, order_date=None, kind='photo'):
        return DeliveryProof.objects.create(
            client=self.client_a,
            order_date=order_date or date.today(),
            kind=kind,
            image=make_image_file(),
            uploaded_by=uploaded_by,
        )


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class DeliveryProofUploadTests(ProofTestBase):
    def test_driver_uploads_photo(self):
        response = self.upload(self.driver_a, kind='photo', image=make_image_file())

        self.assertEqual(response.status_code, 201)
        proof = DeliveryProof.objects.get(proof_id=response.data['proof_id'])
        self.assertEqual(proof.kind, 'photo')
        self.assertEqual(proof.uploaded_by, self.driver_a)
        self.assertTrue(proof.image.storage.exists(proof.image.name))
        self.assertNotIn('proof.jpg', proof.image.name)

    def test_signature_keeps_signer_name(self):
        response = self.upload(
            self.driver_a, kind='signature', signer_name='  Anna Nowak ', image=make_image_file('sig.png', 'PNG')
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(DeliveryProof.objects.get().signer_name, 'Anna Nowak')

    def test_reupload_replaces_previous_proof_and_file(self):
        with self.captureOnCommitCallbacks(execute=True):
            first = self.upload(self.driver_a, kind='photo', image=make_image_file())
        old_name = DeliveryProof.objects.get(proof_id=first.data['proof_id']).image.name

        with self.captureOnCommitCallbacks(execute=True):
            second = self.upload(self.driver_a, kind='photo', image=make_image_file())

        self.assertEqual(second.status_code, 201)
        self.assertEqual(DeliveryProof.objects.filter(kind='photo').count(), 1)
        proof = DeliveryProof.objects.get()
        self.assertFalse(proof.image.storage.exists(old_name))
        self.assertTrue(proof.image.storage.exists(proof.image.name))

    def test_rejects_invalid_uploads(self):
        cases = {
            'unknown kind': {'kind': 'video', 'image': make_image_file()},
            'missing file': {'kind': 'photo'},
            'not an image': {'kind': 'photo', 'image': SimpleUploadedFile('fake.jpg', b'to nie jest obraz')},
            'wrong format': {'kind': 'photo', 'image': make_image_file('x.gif', 'GIF')},
        }
        for label, data in cases.items():
            with self.subTest(label):
                response = self.upload(self.driver_a, **data)
                self.assertEqual(response.status_code, 400)
        self.assertEqual(DeliveryProof.objects.count(), 0)

    def test_rejects_too_large_file(self):
        with mock.patch('dashboard.views.MAX_PROOF_SIZE', 10):
            response = self.upload(self.driver_a, kind='photo', image=make_image_file())

        self.assertEqual(response.status_code, 400)

    def test_requires_delivered_stop(self):
        DailyOrder.objects.filter(pk=self.order.pk).update(status='in_delivery', delivered_at=None)
        response = self.upload(self.driver_a, kind='photo', image=make_image_file())

        self.assertEqual(response.status_code, 400)

    def test_other_driver_cannot_upload(self):
        response = self.upload(self.driver_b, kind='photo', image=make_image_file())

        self.assertEqual(response.status_code, 403)
        self.assertEqual(DeliveryProof.objects.count(), 0)


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class DeliveryProofAccessTests(ProofTestBase):
    def file_url(self, proof):
        return f'/api/logistics/proofs/{proof.proof_id}/file/'

    def test_uploader_and_admin_can_download_file(self):
        proof = self.make_proof(self.driver_a)
        expected = proof.image.read()

        for user in (self.driver_a, self.admin):
            with self.subTest(role=user.role):
                self.api.force_authenticate(user)
                response = self.api.get(self.file_url(proof))
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response['Content-Type'], 'image/jpeg')
                self.assertEqual(b''.join(response.streaming_content), expected)

    def test_other_driver_and_anonymous_cannot_download(self):
        proof = self.make_proof(self.driver_a)

        self.api.force_authenticate(self.driver_b)
        self.assertEqual(self.api.get(self.file_url(proof)).status_code, 403)

        self.api.force_authenticate(None)
        self.assertEqual(self.api.get(self.file_url(proof)).status_code, 401)

    def test_logistics_view_lists_proofs_only_on_stops_with_orders(self):
        proof = self.make_proof(self.driver_a)

        self.api.force_authenticate(self.driver_a)
        stop = self.api.get('/api/logistics/').data['routes'][0]['stops'][0]
        self.assertEqual([p['proof_id'] for p in stop['proofs']], [proof.proof_id])

        self.api.force_authenticate(self.admin)
        routes = self.api.get('/api/logistics/').data['routes']
        admin_stop = next(s for r in routes for s in r['stops'] if s['name'] == 'Klient A7')
        self.assertEqual(admin_stop['proofs'][0]['kind'], 'photo')

    def test_driver_deletes_own_todays_proof(self):
        proof = self.make_proof(self.driver_a)
        name = proof.image.name
        self.api.force_authenticate(self.driver_a)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.api.delete(f'/api/logistics/proofs/{proof.proof_id}/')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(DeliveryProof.objects.exists())
        self.assertFalse(proof.image.storage.exists(name))

    def test_driver_cannot_delete_foreign_or_past_proof(self):
        foreign = self.make_proof(self.admin)
        past = self.make_proof(self.driver_a, order_date=date.today() - timedelta(days=1), kind='signature')
        self.api.force_authenticate(self.driver_a)

        for proof in (foreign, past):
            with self.subTest(proof=proof.kind):
                response = self.api.delete(f'/api/logistics/proofs/{proof.proof_id}/')
                self.assertEqual(response.status_code, 403)
        self.assertEqual(DeliveryProof.objects.count(), 2)

    def test_admin_can_delete_past_proof(self):
        past = self.make_proof(self.driver_a, order_date=date.today() - timedelta(days=1))
        self.api.force_authenticate(self.admin)

        response = self.api.delete(f'/api/logistics/proofs/{past.proof_id}/')

        self.assertEqual(response.status_code, 204)