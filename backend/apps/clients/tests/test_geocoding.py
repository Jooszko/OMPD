import json
import urllib.error
from decimal import Decimal
from unittest import mock

from django.test import SimpleTestCase

from clients.services.geocoding import GeocodingError, geocode_address


def _mock_response(payload):
    body = json.dumps(payload).encode('utf-8')
    response = mock.MagicMock()
    response.__enter__.return_value = response
    response.read.return_value = body
    return response


class GeocodeAddressTests(SimpleTestCase):
    @mock.patch('clients.services.geocoding.urllib.request.urlopen')
    def test_returns_lat_lon_on_match(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response([{'lat': '50.087650', 'lon': '18.204897'}])

        result = geocode_address('Rynek 1, Skoczów')

        self.assertEqual(result, (Decimal('50.087650'), Decimal('18.204897')))
        request = mock_urlopen.call_args[0][0]
        self.assertIn('User-agent', request.headers)

    @mock.patch('clients.services.geocoding.urllib.request.urlopen')
    def test_returns_none_when_no_results(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response([])

        self.assertIsNone(geocode_address('nieistniejący adres xyzzy'))

    @mock.patch('clients.services.geocoding.urllib.request.urlopen')
    def test_raises_geocoding_error_on_network_failure(self, mock_urlopen):
        mock_urlopen.side_effect = urllib.error.URLError('connection refused')

        with self.assertRaises(GeocodingError):
            geocode_address('Rynek 1, Skoczów')

    @mock.patch('clients.services.geocoding.urllib.request.urlopen')
    def test_raises_geocoding_error_on_malformed_response(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response([{'unexpected': 'shape'}])

        with self.assertRaises(GeocodingError):
            geocode_address('Rynek 1, Skoczów')
