import json
import urllib.error
from decimal import Decimal
from unittest import mock

from django.test import SimpleTestCase
from clients.services.geocoding import GeocodeMatch, GeocodingError, geocode_address, lookup_address


def _mock_response(payload):
    body = json.dumps(payload).encode('utf-8')
    response = mock.MagicMock()
    response.__enter__.return_value = response
    response.read.return_value = body
    return response


class GeocodeAddressTests(SimpleTestCase):
    @mock.patch('clients.services.geocoding.urllib.request.urlopen')
    def test_returns_lat_lon_on_match(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response(
            [{'lat': '50.087650', 'lon': '18.204897', 'display_name': '1, Rynek, Skoczów, Polska'}]
        )

        result = geocode_address('Rynek 1, Skoczów')

        self.assertEqual(result, (Decimal('50.087650'), Decimal('18.204897')))
        request = mock_urlopen.call_args[0][0]
        self.assertIn('User-agent', request.headers)

    @mock.patch('clients.services.geocoding.urllib.request.urlopen')
    def test_lookup_returns_the_address_openstreetmap_found(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response(
            [{'lat': '49.7275', 'lon': '18.9031', 'display_name': 'Leśna 22, Brenna, Polska'}]
        )

        result = lookup_address('Leśna 22, Brenna')

        self.assertEqual(result, GeocodeMatch(Decimal('49.7275'), Decimal('18.9031'), 'Leśna 22, Brenna, Polska'))

    @mock.patch('clients.services.geocoding.urllib.request.urlopen')
    def test_skips_matches_from_another_town(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response([
            {'lat': '51.04', 'lon': '21.82', 'display_name': '9, Górna, Józefów nad Wisłą, Polska'},
            {'lat': '49.65', 'lon': '18.86', 'display_name': '9, Górna, Wisła, powiat cieszyński, Polska'},
        ])

        result = lookup_address('Górna 9, Wisła')

        self.assertEqual((result.latitude, result.longitude), (Decimal('49.65'), Decimal('18.86')))

    @mock.patch('clients.services.geocoding.urllib.request.urlopen')
    def test_returns_none_when_no_match_is_in_the_town(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response(
            [{'lat': '51.04', 'lon': '21.82', 'display_name': '6, Główna, Inna Wieś, Polska'}]
        )

        self.assertIsNone(lookup_address('Główna 6, Chybie'))

    @mock.patch('clients.services.geocoding.urllib.request.urlopen')
    def test_address_without_town_takes_the_first_match(self, mock_urlopen):
        mock_urlopen.return_value = _mock_response([{'lat': '49.7', 'lon': '18.9', 'display_name': 'Brenna, Polska'}])

        self.assertIsNotNone(lookup_address('Brenna'))


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
        mock_urlopen.return_value = _mock_response([{'display_name': 'Rynek, Skoczów, Polska'}])
        with self.assertRaises(GeocodingError):
            geocode_address('Rynek 1, Skoczów')
