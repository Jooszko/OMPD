from datetime import date, timedelta
from decimal import Decimal
from django.utils import timezone
from django.test import TestCase
from rest_framework.test import APIClient

from clients.models import Client, Route
from orders.models import DailyOrder
from products.models import Product
from users.models import Notification, User


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
        
    def test_inactive_clients_are_hidden_from_route_stops(self):
        Client.objects.create(
            name='Klient nieaktywny', address='Adres X', route=self.route_a, is_active=False
        )
        self.api.force_authenticate(self.driver_a)
        response = self.api.get('/api/logistics/')

        self.assertEqual(response.status_code, 200)
        stop_names = [s['name'] for s in response.data['routes'][0]['stops']]
        self.assertIn('Klient A', stop_names)
        self.assertNotIn('Klient nieaktywny', stop_names)

    def test_route_stops_include_client_phone(self):
        self.client_a.phone = '+48600100200'
        self.client_a.save(update_fields=['phone'])
        self.api.force_authenticate(self.driver_a)
        response = self.api.get('/api/logistics/')

        self.assertEqual(response.status_code, 200)
        stop = next(s for s in response.data['routes'][0]['stops'] if s['name'] == 'Klient A')
        self.assertEqual(stop['phone'], '+48600100200')

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
            client=client_a, product=product, order_date=date.today(), quantity=1, price_at_sale=Decimal('5.00'),
            status='in_delivery',
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

    def test_driver_cannot_jump_from_planned_to_delivered(self):
        self.order.status = 'planned'
        self.order.save(update_fields=['status'])
        self.api.force_authenticate(self.driver_a)
        response = self.api.patch(f'/api/logistics/orders/{self.order.do_id}/status/', {'status': 'delivered'})
        self.assertEqual(response.status_code, 403)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'planned')

    def test_driver_cannot_update_order_from_another_day(self):
        self.order.order_date = date.today() - timedelta(days=1)
        self.order.save(update_fields=['order_date'])
        self.api.force_authenticate(self.driver_a)
        response = self.api.patch(f'/api/logistics/orders/{self.order.do_id}/status/', {'status': 'delivered'})
        self.assertEqual(response.status_code, 403)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'in_delivery')

    def test_admin_can_update_order_from_another_day(self):
        self.order.order_date = date.today() - timedelta(days=1)
        self.order.save(update_fields=['order_date'])
        self.api.force_authenticate(self.admin)
        response = self.api.patch(f'/api/logistics/orders/{self.order.do_id}/status/', {'status': 'delivered'})
        self.assertEqual(response.status_code, 200)

    def test_driver_can_revert_delivered_to_in_delivery(self):
        self.order.status = 'delivered'
        self.order.save(update_fields=['status'])
        self.api.force_authenticate(self.driver_a)
        response = self.api.patch(f'/api/logistics/orders/{self.order.do_id}/status/', {'status': 'in_delivery'})
        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'in_delivery')

    def test_driver_cannot_revert_delivered_to_planned(self):
        self.order.status = 'delivered'
        self.order.save(update_fields=['status'])
        self.api.force_authenticate(self.driver_a)
        response = self.api.patch(f'/api/logistics/orders/{self.order.do_id}/status/', {'status': 'planned'})
        self.assertEqual(response.status_code, 403)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'delivered')

    def test_driver_cannot_revert_delivery_from_another_day(self):
        self.order.status = 'delivered'
        self.order.order_date = date.today() - timedelta(days=1)
        self.order.save(update_fields=['status', 'order_date'])
        self.api.force_authenticate(self.driver_a)
        response = self.api.patch(f'/api/logistics/orders/{self.order.do_id}/status/', {'status': 'in_delivery'})
        self.assertEqual(response.status_code, 403)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'delivered')

    def test_delivering_sets_delivered_at(self):
        self.api.force_authenticate(self.driver_a)
        before = timezone.now()
        response = self.api.patch(f'/api/logistics/orders/{self.order.do_id}/status/', {'status': 'delivered'})
        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertIsNotNone(self.order.delivered_at)
        self.assertGreaterEqual(self.order.delivered_at, before)

    def test_reverting_delivery_clears_delivered_at(self):
        self.order.status = 'delivered'
        self.order.delivered_at = timezone.now()
        self.order.save(update_fields=['status', 'delivered_at'])
        self.api.force_authenticate(self.driver_a)
        response = self.api.patch(f'/api/logistics/orders/{self.order.do_id}/status/', {'status': 'in_delivery'})
        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertIsNone(self.order.delivered_at)

    def test_nobody_can_set_failed_through_status_patch(self):
        for user in (self.driver_a, self.admin):
            with self.subTest(role=user.role):
                self.api.force_authenticate(user)
                response = self.api.patch(f'/api/logistics/orders/{self.order.do_id}/status/', {'status': 'failed'})
                self.assertEqual(response.status_code, 400)
                self.order.refresh_from_db()
                self.assertEqual(self.order.status, 'in_delivery')

    def _mark_failed(self):
        self.order.status = 'failed'
        self.order.failure_reason = 'closed'
        self.order.failure_note = 'Zamknięte do 10:00'
        self.order.failed_at = timezone.now()
        self.order.save(update_fields=['status', 'failure_reason', 'failure_note', 'failed_at'])

    def test_driver_cannot_revert_failed_through_status_patch(self):
        self._mark_failed()
        self.api.force_authenticate(self.driver_a)
        response = self.api.patch(f'/api/logistics/orders/{self.order.do_id}/status/', {'status': 'in_delivery'})

        self.assertEqual(response.status_code, 403)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'failed')

    def test_admin_reissue_clears_failure_data(self):
        self._mark_failed()
        self.api.force_authenticate(self.admin)
        response = self.api.patch(f'/api/logistics/orders/{self.order.do_id}/status/', {'status': 'in_delivery'})

        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'in_delivery')
        self.assertEqual(self.order.failure_reason, '')
        self.assertEqual(self.order.failure_note, '')
        self.assertIsNone(self.order.failed_at)

class DeliverStopTests(TestCase):
    def setUp(self):
        self.api = APIClient()

        self.driver_a = User.objects.create_user(
            username='driver_a3', password='x', role='driver', full_name='Driver A3'
        )
        self.driver_b = User.objects.create_user(
            username='driver_b3', password='x', role='driver', full_name='Driver B3'
        )
        self.admin = User.objects.create_user(
            username='admin_test3', password='x', role='admin', full_name='Admin Test 3'
        )

        route_a = Route.objects.create(route_name='Trasa A3', driver=self.driver_a)
        self.client_a = Client.objects.create(name='Klient A3', address='Adres A3', route=route_a)
        product = Product.objects.create(name='Rogal', category='bread', base_price=Decimal('3.00'))
        today = date.today()

        def make_order(status, order_date=today):
            return DailyOrder.objects.create(
                client=self.client_a, product=product, order_date=order_date,
                quantity=1, price_at_sale=Decimal('3.00'), status=status,
            )

        self.in_delivery_1 = make_order('in_delivery')
        self.in_delivery_2 = make_order('in_delivery')
        self.planned = make_order('planned')
        self.yesterday = make_order('in_delivery', order_date=today - timedelta(days=1))

        self.url = f'/api/logistics/clients/{self.client_a.client_id}/deliver/'

    def statuses(self):
        for order in (self.in_delivery_1, self.in_delivery_2, self.planned, self.yesterday):
            order.refresh_from_db()
        return (self.in_delivery_1.status, self.in_delivery_2.status, self.planned.status, self.yesterday.status)

    def test_owning_driver_delivers_only_todays_in_delivery_orders(self):
        self.api.force_authenticate(self.driver_a)
        response = self.api.post(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertCountEqual(
            response.data['delivered_ids'], [self.in_delivery_1.do_id, self.in_delivery_2.do_id]
        )
        self.assertEqual(self.statuses(), ('delivered', 'delivered', 'planned', 'in_delivery'))

    def test_other_driver_cannot_deliver_stop(self):
        self.api.force_authenticate(self.driver_b)
        response = self.api.post(self.url)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.statuses(), ('in_delivery', 'in_delivery', 'planned', 'in_delivery'))

    def test_admin_can_deliver_any_stop(self):
        self.api.force_authenticate(self.admin)
        response = self.api.post(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.statuses(), ('delivered', 'delivered', 'planned', 'in_delivery'))

    def test_returns_400_when_nothing_to_deliver(self):
        DailyOrder.objects.filter(pk__in=[self.in_delivery_1.pk, self.in_delivery_2.pk]).update(status='delivered')
        self.api.force_authenticate(self.driver_a)
        response = self.api.post(self.url)

        self.assertEqual(response.status_code, 400)

    def test_deliver_stop_sets_delivered_at_only_for_delivered_orders(self):
        self.api.force_authenticate(self.driver_a)
        response = self.api.post(self.url)
        self.assertIsNotNone(response.data['delivered_at'])
        for order in (self.in_delivery_1, self.in_delivery_2, self.planned):
            order.refresh_from_db()
        self.assertIsNotNone(self.in_delivery_1.delivered_at)
        self.assertEqual(self.in_delivery_1.delivered_at, self.in_delivery_2.delivered_at)
        self.assertIsNone(self.planned.delivered_at)

class ReportProblemTests(TestCase):
    def setUp(self):
        self.api = APIClient()

        self.driver_a = User.objects.create_user(
            username='driver_a4', password='x', role='driver', full_name='Driver A4'
        )
        self.driver_b = User.objects.create_user(
            username='driver_b4', password='x', role='driver', full_name='Driver B4'
        )
        self.admin_1 = User.objects.create_user(
            username='admin_4a', password='x', role='admin', full_name='Admin 4A'
        )
        self.admin_2 = User.objects.create_user(
            username='admin_4b', password='x', role='admin', full_name='Admin 4B'
        )

        route_a = Route.objects.create(route_name='Trasa A4', driver=self.driver_a)
        self.client_a = Client.objects.create(name='Klient A4', address='Adres A4', route=route_a)
        product = Product.objects.create(name='Kajzerka', category='bread', base_price=Decimal('1.00'))

        def make_order(status):
            return DailyOrder.objects.create(
                client=self.client_a, product=product, order_date=date.today(),
                quantity=4, price_at_sale=Decimal('1.00'), status=status,
            )

        self.in_delivery_1 = make_order('in_delivery')
        self.in_delivery_2 = make_order('in_delivery')
        self.delivered = make_order('delivered')

        self.stop_url = f'/api/logistics/clients/{self.client_a.client_id}/report-problem/'

    def order_url(self, order):
        return f'/api/logistics/orders/{order.do_id}/report-problem/'

    def refresh_all(self):
        for order in (self.in_delivery_1, self.in_delivery_2, self.delivered):
            order.refresh_from_db()

    def test_driver_reports_stop_problem(self):
        self.api.force_authenticate(self.driver_a)
        response = self.api.post(self.stop_url, {'reason': 'closed', 'note': 'Zamknięte do 10:00'})

        self.assertEqual(response.status_code, 200)
        self.assertCountEqual(response.data['failed_ids'], [self.in_delivery_1.do_id, self.in_delivery_2.do_id])
        self.refresh_all()
        for order in (self.in_delivery_1, self.in_delivery_2):
            self.assertEqual(order.status, 'failed')
            self.assertEqual(order.failure_reason, 'closed')
            self.assertEqual(order.failure_note, 'Zamknięte do 10:00')
            self.assertIsNotNone(order.failed_at)
        self.assertEqual(self.delivered.status, 'delivered')

    def test_stop_problem_notifies_every_active_admin(self):
        self.api.force_authenticate(self.driver_a)
        self.api.post(self.stop_url, {'reason': 'closed'})

        notifications = Notification.objects.all()
        self.assertCountEqual([n.user for n in notifications], [self.admin_1, self.admin_2])
        for notification in notifications:
            self.assertEqual(notification.sender, self.driver_a)
            self.assertIn('Klient A4', notification.title)
            self.assertIn('Klient zamknięty', notification.message)
            self.assertIn('Kajzerka x4', notification.message)

    def test_driver_reports_single_order_problem(self):
        self.api.force_authenticate(self.driver_a)
        response = self.api.post(self.order_url(self.in_delivery_1), {'reason': 'refused'})

        self.assertEqual(response.status_code, 200)
        self.refresh_all()
        self.assertEqual(self.in_delivery_1.status, 'failed')
        self.assertEqual(self.in_delivery_2.status, 'in_delivery')

    def test_invalid_reason_is_rejected_without_side_effects(self):
        self.api.force_authenticate(self.driver_a)
        for payload in ({}, {'reason': 'lost'}, {'reason': 'other'}, {'reason': 'closed', 'note': 'x' * 501}):
            with self.subTest(payload=payload):
                response = self.api.post(self.stop_url, payload, format='json')
                self.assertEqual(response.status_code, 400)
        self.refresh_all()
        self.assertEqual(self.in_delivery_1.status, 'in_delivery')
        self.assertEqual(Notification.objects.count(), 0)

    def test_other_driver_cannot_report_problem(self):
        self.api.force_authenticate(self.driver_b)
        for url in (self.stop_url, self.order_url(self.in_delivery_1)):
            with self.subTest(url=url):
                response = self.api.post(url, {'reason': 'closed'})
                self.assertEqual(response.status_code, 403)
        self.refresh_all()
        self.assertEqual(self.in_delivery_1.status, 'in_delivery')

    def test_cannot_report_problem_for_delivered_order(self):
        self.api.force_authenticate(self.driver_a)
        response = self.api.post(self.order_url(self.delivered), {'reason': 'closed'})
        self.assertEqual(response.status_code, 400)

    def test_admin_reporting_does_not_notify_themselves(self):
        self.api.force_authenticate(self.admin_1)
        self.api.post(self.stop_url, {'reason': 'no_access'})

        self.assertEqual(list(Notification.objects.values_list('user', flat=True)), [self.admin_2.pk])

    withdraw_url = '/api/logistics/problems/withdraw/'

    def test_driver_withdraws_stop_report_and_admins_are_notified(self):
        self.api.force_authenticate(self.driver_a)
        self.api.post(self.stop_url, {'reason': 'closed'})
        Notification.objects.all().delete()

        ids = [self.in_delivery_1.do_id, self.in_delivery_2.do_id]
        response = self.api.post(self.withdraw_url, {'order_ids': ids}, format='json')

        self.assertEqual(response.status_code, 200)
        self.refresh_all()
        for order in (self.in_delivery_1, self.in_delivery_2):
            self.assertEqual(order.status, 'in_delivery')
            self.assertEqual(order.failure_reason, '')
            self.assertIsNone(order.failed_at)

        notifications = Notification.objects.all()
        self.assertCountEqual([n.user for n in notifications], [self.admin_1, self.admin_2])
        for notification in notifications:
            self.assertEqual(notification.title, 'Zgłoszenie wycofane: Klient A4')
            self.assertIn('Kajzerka x4, Kajzerka x4', notification.message)

    def test_withdraw_is_all_or_nothing(self):
        self.api.force_authenticate(self.driver_a)
        self.api.post(self.order_url(self.in_delivery_1), {'reason': 'closed'})
        Notification.objects.all().delete()

        response = self.api.post(
            self.withdraw_url, {'order_ids': [self.in_delivery_1.do_id, self.delivered.do_id]}, format='json'
        )

        self.assertEqual(response.status_code, 400)
        self.refresh_all()
        self.assertEqual(self.in_delivery_1.status, 'failed')
        self.assertEqual(Notification.objects.count(), 0)

    def test_other_driver_cannot_withdraw(self):
        self.api.force_authenticate(self.driver_a)
        self.api.post(self.stop_url, {'reason': 'closed'})

        self.api.force_authenticate(self.driver_b)
        response = self.api.post(self.withdraw_url, {'order_ids': [self.in_delivery_1.do_id]}, format='json')

        self.assertEqual(response.status_code, 403)
        self.refresh_all()
        self.assertEqual(self.in_delivery_1.status, 'failed')

    def test_withdraw_rejects_invalid_payload(self):
        self.api.force_authenticate(self.driver_a)
        for payload in ({}, {'order_ids': []}, {'order_ids': 'abc'}, {'order_ids': ['1']}):
            with self.subTest(payload=payload):
                response = self.api.post(self.withdraw_url, payload, format='json')
                self.assertEqual(response.status_code, 400)