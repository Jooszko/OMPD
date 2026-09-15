import json
import urllib.error
import urllib.request
from django.conf import settings

OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving'
ORS_URL = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson'
USER_AGENT = 'OMPD-bakery-erp/1.0 (route directions)'


class RoutingError(Exception):
    pass


def get_route_directions(coordinates: list[tuple[float, float]], *, timeout: int = 15) -> dict:
    """coordinates: (lat, lng) tuples in visiting order, at least 2.

    Returns {'coordinates': [[lat, lng], ...], 'distance_m': float, 'duration_s': float, 'provider': str}.
    """
    if len(coordinates) < 2:
        raise RoutingError('Potrzeba co najmniej 2 zgeokodowanych punktów, aby wyznaczyć trasę.')

    if settings.ORS_API_KEY:
        return _directions_ors(coordinates, timeout=timeout)
    return _directions_osrm(coordinates, timeout=timeout)


def _directions_osrm(coordinates, *, timeout):
    coords_str = ';'.join(f'{lng},{lat}' for lat, lng in coordinates)
    url = f'{OSRM_BASE_URL}/{coords_str}?overview=full&geometries=geojson'
    request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    data = _fetch_json(request, timeout)

    if data.get('code') != 'Ok' or not data.get('routes'):
        raise RoutingError(f'OSRM nie znalazł trasy: {data.get("message", data.get("code", "brak danych"))}')

    route = data['routes'][0]
    return {
        'coordinates': [[lat, lng] for lng, lat in route['geometry']['coordinates']],
        'distance_m': route['distance'],
        'duration_s': route['duration'],
        'provider': 'osrm',
    }


def _directions_ors(coordinates, *, timeout):
    body = json.dumps({'coordinates': [[lng, lat] for lat, lng in coordinates]}).encode('utf-8')
    request = urllib.request.Request(
        ORS_URL,
        data=body,
        method='POST',
        headers={
            'Content-Type': 'application/json',
            'Authorization': settings.ORS_API_KEY,
            'User-Agent': USER_AGENT,
        },
    )
    data = _fetch_json(request, timeout)

    features = data.get('features')
    if not features:
        raise RoutingError('OpenRouteService nie zwrócił trasy.')

    feature = features[0]
    summary = feature['properties']['summary']
    return {
        'coordinates': [[lat, lng] for lng, lat in feature['geometry']['coordinates']],
        'distance_m': summary['distance'],
        'duration_s': summary['duration'],
        'provider': 'ors',
    }


def _fetch_json(request, timeout):
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.load(response)
    except (urllib.error.URLError, TimeoutError) as exc:
        raise RoutingError(f'Nie udało się połączyć z serwisem routingu: {exc}') from exc
    except json.JSONDecodeError as exc:
        raise RoutingError(f'Nieprawidłowa odpowiedź serwisu routingu: {exc}') from exc
