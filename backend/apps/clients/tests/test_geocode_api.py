from decimal import Decimal
from unittest import mock

from django.test import TestCase
from rest_framework.test import APIClient

from audit.models import AuditEntry
from clients.models import Client, Route
from clients.services.geocoding import GeocodeMatch, GeocodingError
from users.models import User

MATCH = GeocodeMatch(Decimal('49.727500'), Decimal('18.903100'), 'Leśna 22, 43-438 Brenna, Polska')


@mock.patch('clients.views.wait_for_turn')
@mock.patch('clients.views.lookup_address')
class GeocodeApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = User.objects.create_user(username='admin_g', password='x', role='admin', full_name='Admin G')
        self.baker = User.objects.create_user(username='baker_g', password='x', role='baker', full_name='Baker G')
        route = Route.objects.create(route_name='Trasa 4')
        self.client_obj = Client.objects.create(name='Kawiarnia', address='Leśna 22, Brenna', route=route)
        self.api.force_authenticate(self.admin)

    def test_preview_returns_coordinates_and_found_address(self, lookup, wait):
        lookup.return_value = MATCH

        response = self.api.post('/api/clients/geocode/', {'address': 'Leśna 22, Brenna'}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {'latitude': '49.727500', 'longitude': '18.903100', 'label': MATCH.label})
        wait.assert_called_once()

    def test_preview_explains_missing_address_and_no_match(self, lookup, wait):
        lookup.return_value = None

        empty = self.api.post('/api/clients/geocode/', {'address': '  '}, format='json')
        missing = self.api.post('/api/clients/geocode/', {'address': 'Nieistniejąca 1'}, format='json')

        self.assertEqual((empty.status_code, empty.data['code']), (400, 'empty'))
        self.assertEqual((missing.status_code, missing.data['code']), (404, 'not_found'))

    def test_service_outage_is_reported_as_unavailable(self, lookup, wait):
        lookup.side_effect = GeocodingError('timeout')

        response = self.api.post('/api/clients/geocode/', {'address': 'Leśna 22, Brenna'}, format='json')

        self.assertEqual((response.status_code, response.data['code']), (503, 'unavailable'))

    def test_client_geocode_saves_coordinates_and_logs_it(self, lookup, wait):
        lookup.return_value = MATCH

        response = self.api.post(f'/api/clients/{self.client_obj.pk}/geocode/')

        self.assertEqual(response.status_code, 200)
        self.client_obj.refresh_from_db()
        self.assertEqual((self.client_obj.latitude, self.client_obj.longitude), (MATCH.latitude, MATCH.longitude))
        self.assertIsNotNone(self.client_obj.geocoded_at)
        self.assertTrue(AuditEntry.objects.filter(action='client.geocoded', object_id=str(self.client_obj.pk)).exists())
        lookup.assert_called_once_with('Leśna 22, Brenna')

    def test_failed_client_geocode_keeps_old_coordinates(self, lookup, wait):
        lookup.return_value = None

        response = self.api.post(f'/api/clients/{self.client_obj.pk}/geocode/')

        self.assertEqual(response.status_code, 404)
        self.client_obj.refresh_from_db()
        self.assertIsNone(self.client_obj.latitude)

    def test_only_admin_can_geocode(self, lookup, wait):
        self.api.force_authenticate(self.baker)

        self.assertEqual(self.api.post('/api/clients/geocode/', {'address': 'x'}, format='json').status_code, 403)
        self.assertEqual(self.api.post(f'/api/clients/{self.client_obj.pk}/geocode/').status_code, 403)
        lookup.assert_not_called()