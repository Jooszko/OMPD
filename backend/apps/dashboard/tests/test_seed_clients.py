from django.test import TestCase

from clients.models import Client, Route
from users.models import User
from dashboard.seed.clients import create_clients, create_routes


class SeedClientsTests(TestCase):
    def setUp(self):
        self.drivers = [
            User.objects.create_user(
                username=f'driver{i}', password='x', role='driver', full_name=f'Driver {i}'
            )
            for i in range(6)
        ]

    def test_create_routes_assigns_one_driver_each(self):
        routes = create_routes(self.drivers)

        self.assertEqual(len(routes), 6)
        self.assertEqual(Route.objects.count(), 6)
        assigned_driver_ids = {route.driver_id for route in routes}
        expected_driver_ids = {driver.user_id for driver in self.drivers}
        self.assertEqual(assigned_driver_ids, expected_driver_ids)

    def test_create_clients_creates_forty_with_three_inactive(self):
        routes = create_routes(self.drivers)

        clients = create_clients(routes)

        self.assertEqual(len(clients), 40)
        self.assertEqual(Client.objects.count(), 40)
        inactive = [c for c in clients if not c.is_active]
        self.assertEqual(len(inactive), 3)
        names = {c.name for c in clients}
        self.assertEqual(len(names), 40)

    def test_create_routes_is_idempotent(self):
        create_routes(self.drivers)
        create_routes(self.drivers)

        self.assertEqual(Route.objects.count(), 6)
