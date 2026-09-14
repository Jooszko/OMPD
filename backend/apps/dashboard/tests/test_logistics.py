from datetime import date
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from clients.models import Client, Route
from orders.models import DailyOrder
from products.models import Product
from users.models import User


class LogisticsViewRoleTests(TestCase):
    def setUp(self):
        self.api = APIClient()

        self.admin = User.objects.create_user(
            username='admin_test', password='x', role='admin', full_name='Admin Test'
        )
        self.baker = User.objects.create_user(
            username='baker_test', password='x', role='baker', full_name='Baker Test'
        )
        self.driver_a = User.objects.create_user(
            username='driver_a', password='x', role='driver', full_name='Driver A'
        )
        self.driver_b = User.objects.create_user(
            username='driver_b', password='x', role='driver', full_name='Driver B'
        )

        self.route_a = Route.objects.create(route_name='Trasa A', driver=self.driver_a)
        self.route_b = Route.objects.create(route_name='Trasa B', driver=self.driver_b)

        self.client_a = Client.objects.create(name='Klient A', address='Adres A', route=self.route_a)
        self.client_b = Client.objects.create(name='Klient B', address='Adres B', route=self.route_b)
        self.client_unassigned_route = Route.objects.create(route_name='Trasa C', driver=None)
        self.client_unassigned = Client.objects.create(
            name='Klient bez kierowcy', address='Adres C', route=self.client_unassigned_route
        )

        self.product = Product.objects.create(name='Chleb', category='bread', base_price=Decimal('10.00'))
        today = date.today()
        self.order_a = DailyOrder.objects.create(
            client=self.client_a, product=self.product, order_date=today, quantity=1, price_at_sale=Decimal('10.00')
        )
        self.order_b = DailyOrder.objects.create(
            client=self.client_b, product=self.product, order_date=today, quantity=1, price_at_sale=Decimal('10.00')
        )

    def test_unauthenticated_is_rejected(self):
        response = self.api.get('/api/logistics/')
        self.assertEqual(response.status_code, 401)

    def test_baker_role_is_forbidden(self):
        self.api.force_authenticate(self.baker)
        response = self.api.get('/api/logistics/')
        self.assertEqual(response.status_code, 403)

    def test_admin_sees_all_routes_and_drivers_list(self):
        self.api.force_authenticate(self.admin)
        response = self.api.get('/api/logistics/')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['routes']), 3)
        self.assertEqual(payload['viewer'], {'role': 'admin', 'is_preview': False, 'driver_id': None})
        driver_names = {d['full_name'] for d in payload['drivers']}
        self.assertEqual(driver_names, {'Driver A', 'Driver B'})

    def test_driver_sees_only_own_route(self):
        self.api.force_authenticate(self.driver_a)
        response = self.api.get('/api/logistics/')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['routes']), 1)
        self.assertEqual(payload['routes'][0]['route_id'], self.route_a.route_id)
        self.assertEqual(payload['unassigned'], [])
        self.assertEqual(payload['viewer'], {'role': 'driver', 'is_preview': False, 'driver_id': self.driver_a.user_id})

    def test_driver_cannot_use_preview_param(self):
        self.api.force_authenticate(self.driver_a)
        response = self.api.get('/api/logistics/', {'driver': self.driver_b.user_id})
        self.assertEqual(response.status_code, 403)

    def test_admin_can_preview_a_driver(self):
        self.api.force_authenticate(self.admin)
        response = self.api.get('/api/logistics/', {'driver': self.driver_b.user_id})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['routes']), 1)
        self.assertEqual(payload['routes'][0]['route_id'], self.route_b.route_id)
        self.assertEqual(payload['viewer'], {'role': 'admin', 'is_preview': True, 'driver_id': self.driver_b.user_id})

    def test_admin_preview_of_unknown_driver_is_404(self):
        self.api.force_authenticate(self.admin)
        response = self.api.get('/api/logistics/', {'driver': 999999})
        self.assertEqual(response.status_code, 404)


class UpdateOrderStatusPermissionTests(TestCase):
    def setUp(self):
        self.api = APIClient()

        self.driver_a = User.objects.create_user(
            username='driver_a2', password='x', role='driver', full_name='Driver A2'
        )
        self.driver_b = User.objects.create_user(
            username='driver_b2', password='x', role='driver', full_name='Driver B2'
        )
        self.admin = User.objects.create_user(
            username='admin_test2', password='x', role='admin', full_name='Admin Test 2'
        )

        route_a = Route.objects.create(route_name='Trasa A2', driver=self.driver_a)
        client_a = Client.objects.create(name='Klient A2', address='Adres A2', route=route_a)
        product = Product.objects.create(name='Bulka', category='bread', base_price=Decimal('5.00'))
        self.order = DailyOrder.objects.create(
            client=client_a, product=product, order_date=date.today(), quantity=1, price_at_sale=Decimal('5.00')
        )

    def test_owning_driver_can_update_status(self):
        self.api.force_authenticate(self.driver_a)
        response = self.api.patch(f'/api/logistics/orders/{self.order.do_id}/status/', {'status': 'delivered'})
        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'delivered')

    def test_other_driver_cannot_update_status(self):
        self.api.force_authenticate(self.driver_b)
        response = self.api.patch(f'/api/logistics/orders/{self.order.do_id}/status/', {'status': 'delivered'})
        self.assertEqual(response.status_code, 403)

    def test_admin_can_update_any_order_status(self):
        self.api.force_authenticate(self.admin)
        response = self.api.patch(f'/api/logistics/orders/{self.order.do_id}/status/', {'status': 'delivered'})
        self.assertEqual(response.status_code, 200)
