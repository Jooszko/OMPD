from django.test import TestCase
from rest_framework.test import APIClient

from clients.models import Client, Route
from users.models import User

ENDPOINTS = [
    ('/api/dashboard/', {'admin', 'baker'}),
    ('/api/orders/daily/', {'admin', 'baker'}),
    ('/api/orders/standing/', {'admin', 'baker'}),
    ('/api/orders/history/', {'admin', 'baker'}),
    ('/api/products/', {'admin', 'baker'}),
    ('/api/products/ingredients/', {'admin', 'baker'}),
    ('/api/products/recipes/', {'admin', 'baker'}),
    ('/api/clients/', {'admin', 'baker'}),
    ('/api/clients/routes/', {'admin'}),
    ('/api/finance/daily-summary/', {'admin'}),
    ('/api/finance/expenses/', {'admin'}),
    ('/api/finance/reports/', {'admin'}),
    ('/api/finance/suppliers/', {'admin'}),
    ('/api/finance/top-clients/', {'admin'}),
]


class ApiAccessTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.users = {
            role: User.objects.create_user(username=f'{role}_acc', password='x', role=role, full_name=role)
            for role in ('admin', 'baker', 'driver')
        }

    def test_anonymous_requests_are_rejected_everywhere(self):
        for url, _ in ENDPOINTS:
            with self.subTest(url=url):
                self.assertEqual(self.api.get(url).status_code, 401)

    def test_each_role_reaches_only_its_modules(self):
        for url, allowed in ENDPOINTS:
            for role, user in self.users.items():
                with self.subTest(url=url, role=role):
                    self.api.force_authenticate(user)
                    status = self.api.get(url).status_code
                    if role in allowed:
                        self.assertNotIn(status, (401, 403))
                    else:
                        self.assertEqual(status, 403)

    def test_baker_can_read_clients_but_not_change_them(self):
        client = Client.objects.create(
            name='Sklep A', address='Adres A', route=Route.objects.create(route_name='Trasa A')
        )
        self.api.force_authenticate(self.users['baker'])

        created = self.api.post('/api/clients/', {'name': 'Nowy', 'address': 'X'}, format='json')
        edited = self.api.put(f'/api/clients/{client.pk}/', {'name': 'Zmieniony'}, format='json')

        self.assertEqual((created.status_code, edited.status_code), (403, 403))
        client.refresh_from_db()
        self.assertEqual(client.name, 'Sklep A')

    def test_driver_cannot_change_orders_or_prices(self):
        self.api.force_authenticate(self.users['driver'])

        self.assertEqual(self.api.post('/api/orders/daily/', {}, format='json').status_code, 403)
        self.assertEqual(self.api.patch('/api/products/1/', {'base_price': '0.01'}, format='json').status_code, 403)