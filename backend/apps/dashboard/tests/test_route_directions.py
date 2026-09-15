from datetime import date
from decimal import Decimal
from unittest import mock

from django.test import TestCase
from rest_framework.test import APIClient

from clients.models import Client, Route
from dashboard.services.routing import RoutingError
from orders.models import DailyOrder
from products.models import Product
from users.models import User


class RouteDirectionsViewTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = User.objects.create_user(username='admin_rd', password='x', role='admin', full_name='Admin')
        self.driver_a = User.objects.create_user(username='driver_rd_a', password='x', role='driver', full_name='Driver A')
        self.driver_b = User.objects.create_user(username='driver_rd_b', password='x', role='driver', full_name='Driver B')

        self.route = Route.objects.create(route_name='Trasa RD', driver=self.driver_a)
        self.client_1 = Client.objects.create(
            name='Klient 1', address='Adres 1', route=self.route,
            latitude=Decimal('50.000000'), longitude=Decimal('18.000000'),
        )
        self.client_2 = Client.objects.create(
            name='Klient 2', address='Adres 2', route=self.route,
            latitude=Decimal('50.100000'), longitude=Decimal('18.100000'),
        )
        self.product = Product.objects.create(name='Chleb', category='bread', base_price=Decimal('10.00'))
        today = date.today()
        DailyOrder.objects.create(client=self.client_1, product=self.product, order_date=today, quantity=1, price_at_sale=Decimal('10.00'))
        DailyOrder.objects.create(client=self.client_2, product=self.product, order_date=today, quantity=1, price_at_sale=Decimal('10.00'))

    def _url(self):
        return f'/api/logistics/routes/{self.route.route_id}/directions/'

    def test_unauthenticated_is_rejected(self):
        response = self.api.get(self._url())
        self.assertEqual(response.status_code, 401)

    def test_other_driver_is_forbidden(self):
        self.api.force_authenticate(self.driver_b)
        response = self.api.get(self._url())
        self.assertEqual(response.status_code, 403)

    def test_invalid_date_is_rejected(self):
        self.api.force_authenticate(self.admin)
        response = self.api.get(self._url(), {'date': 'not-a-date'})
        self.assertEqual(response.status_code, 400)

    @mock.patch('dashboard.views.get_route_directions')
    def test_owning_driver_gets_directions(self, mock_get_directions):
        mock_get_directions.return_value = {
            'coordinates': [[50.0, 18.0], [50.1, 18.1]],
            'distance_m': 5000.0,
            'duration_s': 600.0,
            'provider': 'osrm',
        }
        self.api.force_authenticate(self.driver_a)
        response = self.api.get(self._url())

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['provider'], 'osrm')
        self.assertEqual(payload['geometry']['coordinates'], [[50.0, 18.0], [50.1, 18.1]])
        self.assertEqual(payload['skipped_stops'], [])
        mock_get_directions.assert_called_once_with([(50.0, 18.0), (50.1, 18.1)])

    def test_fewer_than_two_routable_stops_returns_note(self):
        self.client_2.latitude = None
        self.client_2.longitude = None
        self.client_2.save(update_fields=['latitude', 'longitude'])

        self.api.force_authenticate(self.admin)
        response = self.api.get(self._url())

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIsNone(payload['geometry'])
        self.assertEqual(payload['skipped_stops'], ['Klient 2'])
        self.assertIsNotNone(payload['note'])

    @mock.patch('dashboard.views.get_route_directions')
    def test_routing_error_returns_502(self, mock_get_directions):
        mock_get_directions.side_effect = RoutingError('boom')
        self.api.force_authenticate(self.admin)
        response = self.api.get(self._url())
        self.assertEqual(response.status_code, 502)

    @mock.patch('dashboard.views.get_route_directions')
    def test_two_stops_are_not_reordered(self, mock_get_directions):
        # Nothing to optimize with only 2 points — order stays as given.
        mock_get_directions.return_value = {
            'coordinates': [], 'distance_m': 0.0, 'duration_s': 0.0, 'provider': 'osrm',
        }
        self.api.force_authenticate(self.admin)
        response = self.api.get(self._url())

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()['optimized'])
        mock_get_directions.assert_called_once_with([(50.0, 18.0), (50.1, 18.1)])

    @mock.patch('dashboard.views.get_route_directions')
    def test_three_or_more_stops_are_optimized_automatically(self, mock_get_directions):
        # Client 3 sits right next to Client 1 (start), far from Client 2 —
        # the default (name) order visits 1, 2, 3; optimization always runs
        # for 3+ stops, so it should visit the near point (3) before the far one (2).
        Client.objects.create(
            name='Klient 3', address='Adres 3', route=self.route,
            latitude=Decimal('50.001000'), longitude=Decimal('18.001000'),
        )
        DailyOrder.objects.create(
            client=Client.objects.get(name='Klient 3'), product=self.product,
            order_date=date.today(), quantity=1, price_at_sale=Decimal('10.00'),
        )
        mock_get_directions.return_value = {
            'coordinates': [], 'distance_m': 0.0, 'duration_s': 0.0, 'provider': 'osrm',
        }
        self.api.force_authenticate(self.admin)
        response = self.api.get(self._url())

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['optimized'])
        called_coords = mock_get_directions.call_args[0][0]
        self.assertEqual(called_coords[0], (50.0, 18.0))
        self.assertEqual(called_coords[1], (50.001, 18.001))
        ordered_names = [s['name'] for s in payload['ordered_stops']]
        self.assertEqual(ordered_names, ['Klient 1', 'Klient 3', 'Klient 2'])
