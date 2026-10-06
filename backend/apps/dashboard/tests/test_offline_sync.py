import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from clients.models import Client, Route
from dashboard.models import ClientAction
from orders.models import DailyOrder
from products.models import Product
from users.models import User


class OfflineSyncTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.driver = User.objects.create_user(
            username='driver_8', password='x', role='driver', full_name='Driver 8'
        )
        route = Route.objects.create(route_name='Trasa 8', driver=self.driver)
        self.client_obj = Client.objects.create(name='Klient 8', address='Adres 8', route=route)
        product = Product.objects.create(name='Rogalik', category='bread', base_price=Decimal('1.50'))
        self.order = DailyOrder.objects.create(
            client=self.client_obj, product=product, order_date=date.today(),
            quantity=6, price_at_sale=Decimal('1.50'), status='in_delivery',
        )
        self.api.force_authenticate(self.driver)
        self.status_url = f'/api/logistics/orders/{self.order.do_id}/status/'

    def headers(self, occurred_at=None, action_id=None):
        result = {}
        if occurred_at is not None:
            result['HTTP_X_OCCURRED_AT'] = occurred_at
        if action_id is not None:
            result['HTTP_X_CLIENT_ACTION_ID'] = action_id
        return result

    def minutes_ago(self, minutes):
        return (timezone.now() - timedelta(minutes=minutes)).isoformat()

    def test_delivery_uses_time_from_phone(self):
        occurred = timezone.now() - timedelta(minutes=30)
        response = self.api.patch(self.status_url, {'status': 'delivered'}, **self.headers(occurred.isoformat()))

        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.delivered_at, occurred)

    def test_invalid_occurred_at_is_rejected(self):
        naive = datetime.now().replace(microsecond=0).isoformat()
        future = (timezone.now() + timedelta(hours=1)).isoformat()
        yesterday = (timezone.now() - timedelta(days=1)).isoformat()
        for label, value in {'garbage': 'wczoraj', 'naive': naive, 'future': future, 'yesterday': yesterday}.items():
            with self.subTest(label):
                response = self.api.patch(self.status_url, {'status': 'delivered'}, **self.headers(value))
                self.assertEqual(response.status_code, 400)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'in_delivery')

    def test_undo_window_is_measured_from_undo_time(self):
        DailyOrder.objects.filter(pk=self.order.pk).update(
            status='delivered', delivered_at=timezone.now() - timedelta(minutes=30)
        )

        late = self.api.patch(self.status_url, {'status': 'in_delivery'})
        self.assertEqual(late.status_code, 403)

        queued = self.api.patch(self.status_url, {'status': 'in_delivery'}, **self.headers(self.minutes_ago(25)))
        self.assertEqual(queued.status_code, 200)

    def test_repeated_action_is_applied_once(self):
        action_id = str(uuid.uuid4())
        url = f'/api/logistics/clients/{self.client_obj.client_id}/deliver/'

        first = self.api.post(url, **self.headers(action_id=action_id))
        second = self.api.post(url, **self.headers(action_id=action_id))

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertTrue(second.data['duplicate'])
        self.assertEqual(ClientAction.objects.filter(action_id=action_id).count(), 1)

    def test_rejected_action_is_not_remembered(self):
        action_id = str(uuid.uuid4())
        rejected = self.api.patch(self.status_url, {'status': 'planned'}, **self.headers(action_id=action_id))
        self.assertEqual(rejected.status_code, 403)
        self.assertFalse(ClientAction.objects.filter(action_id=action_id).exists())

        accepted = self.api.patch(self.status_url, {'status': 'delivered'}, **self.headers(action_id=action_id))
        self.assertEqual(accepted.status_code, 200)
        self.assertNotIn('duplicate', accepted.data)

    def test_invalid_action_id_is_rejected(self):
        response = self.api.patch(self.status_url, {'status': 'delivered'}, **self.headers(action_id='abc'))
        self.assertEqual(response.status_code, 400)

    def test_problem_report_uses_time_from_phone(self):
        occurred = timezone.now() - timedelta(minutes=12)
        response = self.api.post(
            f'/api/logistics/clients/{self.client_obj.client_id}/report-problem/',
            {'reason': 'closed'},
            **self.headers(occurred.isoformat()),
        )

        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.failed_at, occurred)