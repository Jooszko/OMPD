from datetime import timedelta
from unittest import mock

from django.test import TestCase, override_settings
from django.utils import timezone

from dashboard.models import RouteDirectionsCache
from dashboard.services.directions_cache import get_cached_route_directions
from dashboard.services.routing import RoutingError

COORDS = [(50.0, 18.0), (50.1, 18.1)]
API_RESULT = {
    'coordinates': [[50.0, 18.0], [50.1, 18.1]],
    'distance_m': 1234.0,
    'duration_s': 300.0,
    'provider': 'osrm',
}


@override_settings(ORS_API_KEY='')
class DirectionsCacheTests(TestCase):
    @mock.patch('dashboard.services.directions_cache.get_route_directions', return_value=API_RESULT)
    def test_second_call_is_served_from_cache(self, mock_api):
        first = get_cached_route_directions(COORDS)
        second = get_cached_route_directions(COORDS)

        self.assertEqual(first, second)
        mock_api.assert_called_once()
        self.assertEqual(RouteDirectionsCache.objects.count(), 1)

    @mock.patch('dashboard.services.directions_cache.get_route_directions', return_value=API_RESULT)
    def test_different_stop_order_is_a_different_entry(self, mock_api):
        get_cached_route_directions(COORDS)
        get_cached_route_directions(list(reversed(COORDS)))

        self.assertEqual(mock_api.call_count, 2)
        self.assertEqual(RouteDirectionsCache.objects.count(), 2)

    @mock.patch('dashboard.services.directions_cache.get_route_directions', return_value=API_RESULT)
    def test_expired_entry_is_refetched(self, mock_api):
        get_cached_route_directions(COORDS)
        RouteDirectionsCache.objects.update(fetched_at=timezone.now() - timedelta(days=31))

        get_cached_route_directions(COORDS)

        self.assertEqual(mock_api.call_count, 2)
        self.assertEqual(RouteDirectionsCache.objects.count(), 1)

    @mock.patch('dashboard.services.directions_cache.get_route_directions', side_effect=RoutingError('down'))
    def test_errors_are_not_cached(self, mock_api):
        with self.assertRaises(RoutingError):
            get_cached_route_directions(COORDS)

        self.assertEqual(RouteDirectionsCache.objects.count(), 0)
