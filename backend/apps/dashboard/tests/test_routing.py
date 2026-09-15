import json
from unittest import mock

from django.test import SimpleTestCase, override_settings

from dashboard.services.routing import RoutingError, get_route_directions


def _mock_response(payload):
    body = json.dumps(payload).encode('utf-8')
    response = mock.MagicMock()
    response.__enter__.return_value = response
    response.read.return_value = body
    return response


OSRM_OK_PAYLOAD = {
    'code': 'Ok',
    'routes': [{
        'geometry': {'coordinates': [[18.2, 50.0], [18.3, 50.1]]},
        'distance': 1234.5,
        'duration': 321.0,
    }],
}

ORS_OK_PAYLOAD = {
    'features': [{
        'geometry': {'coordinates': [[18.2, 50.0], [18.3, 50.1]]},
        'properties': {'summary': {'distance': 999.0, 'duration': 111.0}},
    }],
}


@override_settings(ORS_API_KEY='')
class RoutingServiceOsrmTests(SimpleTestCase):
    def test_requires_at_least_two_points(self):
        with self.assertRaises(RoutingError):
            get_route_directions([(50.0, 18.2)])

    @mock.patch('dashboard.services.routing.urllib.request.urlopen')
    def test_uses_osrm_when_no_ors_key(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response(OSRM_OK_PAYLOAD)

        result = get_route_directions([(50.0, 18.2), (50.1, 18.3)])

        self.assertEqual(result['provider'], 'osrm')
        self.assertEqual(result['coordinates'], [[50.0, 18.2], [50.1, 18.3]])
        self.assertEqual(result['distance_m'], 1234.5)
        self.assertEqual(result['duration_s'], 321.0)
        url = mock_urlopen.call_args[0][0].full_url
        self.assertIn('router.project-osrm.org', url)

    @mock.patch('dashboard.services.routing.urllib.request.urlopen')
    def test_raises_on_osrm_no_route(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response({'code': 'NoRoute'})

        with self.assertRaises(RoutingError):
            get_route_directions([(50.0, 18.2), (50.1, 18.3)])


@override_settings(ORS_API_KEY='test-key-123')
class RoutingServiceOrsTests(SimpleTestCase):
    @mock.patch('dashboard.services.routing.urllib.request.urlopen')
    def test_uses_ors_when_key_configured(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response(ORS_OK_PAYLOAD)

        result = get_route_directions([(50.0, 18.2), (50.1, 18.3)])

        self.assertEqual(result['provider'], 'ors')
        self.assertEqual(result['coordinates'], [[50.0, 18.2], [50.1, 18.3]])
        self.assertEqual(result['distance_m'], 999.0)
        request = mock_urlopen.call_args[0][0]
        self.assertIn('api.openrouteservice.org', request.full_url)
        self.assertEqual(request.headers['Authorization'], 'test-key-123')
