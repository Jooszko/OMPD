import shutil
import tempfile
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

from django.test import TestCase, override_settings
from PIL import Image

from dashboard.seed.clear import clear_all
from dashboard.seed.clients import create_clients, create_routes
from dashboard.seed.dates import build_date_range
from dashboard.seed.orders import create_daily_orders, create_standing_orders
from dashboard.seed.products import create_ingredients, create_products
from dashboard.seed.proofs import PROOF_DAYS, create_delivery_proofs
from orders.models import DailyOrder, DeliveryProof
from users.models import User

TEMP_MEDIA_ROOT = tempfile.mkdtemp()
SEED_PHOTO_PATH = Path(TEMP_MEDIA_ROOT) / 'delivery_photo.jpg'
TODAY = date(2026, 10, 21)


def tearDownModule():
    shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class SeedDeliveryProofsTests(TestCase):
    def setUp(self):
        Image.new('RGB', (640, 480), '#c9d3d9').save(SEED_PHOTO_PATH, format='JPEG')
        patcher = patch('dashboard.seed.proofs.DELIVERY_PHOTO_PATH', SEED_PHOTO_PATH)
        patcher.start()
        self.addCleanup(patcher.stop)

        drivers = [
            User.objects.create_user(username=f'proof_driver{i}', password='x', role='driver', full_name=f'Driver {i}')
            for i in range(6)
        ]
        clients = create_clients(create_routes(drivers))
        products = create_products(create_ingredients())
        standing_orders = create_standing_orders(clients, products)
        create_daily_orders(clients, products, standing_orders, build_date_range(TODAY, 30))

    def test_recent_delivered_stops_get_photos_and_signatures(self):
        created_count = create_delivery_proofs(TODAY)

        proofs = DeliveryProof.objects.all()
        self.assertEqual(proofs.count(), created_count)
        self.assertEqual(set(proofs.values_list('kind', flat=True)), {'photo', 'signature'})
        self.assertFalse(proofs.filter(order_date__lt=TODAY - timedelta(days=PROOF_DAYS)).exists())
        for proof in proofs:
            self.assertTrue(DailyOrder.objects.filter(
                client_id=proof.client_id, order_date=proof.order_date, status='delivered',
            ).exists())
        self.assertFalse(proofs.filter(kind='signature', signer_name='').exists())

    def test_files_are_real_images(self):
        create_delivery_proofs(TODAY)

        photo = DeliveryProof.objects.filter(kind='photo').first()
        self.assertEqual(Path(photo.image.path).read_bytes(), SEED_PHOTO_PATH.read_bytes())
        with Image.open(photo.image.path) as image:
            self.assertEqual((image.format, image.size), ('JPEG', (640, 480)))
        signature = DeliveryProof.objects.filter(kind='signature').first()
        with Image.open(signature.image.path) as image:
            self.assertEqual(image.format, 'PNG')

    def test_missing_seed_photo_reports_its_path(self):
        missing_path = SEED_PHOTO_PATH.with_name('missing.jpg')
        with patch('dashboard.seed.proofs.DELIVERY_PHOTO_PATH', missing_path):
            with self.assertRaises(FileNotFoundError) as error:
                create_delivery_proofs(TODAY)
        self.assertIn(str(missing_path), str(error.exception))

    def test_is_idempotent(self):
        create_delivery_proofs(TODAY)

        self.assertEqual(create_delivery_proofs(TODAY), 0)

    def test_clear_removes_proof_files(self):
        create_delivery_proofs(TODAY)
        storage, name = DeliveryProof.objects.first().image.storage, DeliveryProof.objects.first().image.name

        clear_all()

        self.assertFalse(DeliveryProof.objects.exists())
        self.assertFalse(storage.exists(name))