import hashlib
import json
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from ..models import RouteDirectionsCache
from .routing import get_route_directions

CACHE_TTL = timedelta(days=30)


def _current_provider() -> str:
    return 'ors' if settings.ORS_API_KEY else 'osrm'


def _cache_key(provider: str, coordinates: list[tuple[float, float]]) -> str:
    payload = json.dumps([provider, [[round(lat, 6), round(lng, 6)] for lat, lng in coordinates]])
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()


def get_cached_route_directions(coordinates: list[tuple[float, float]]) -> dict:
    provider = _current_provider()
    key = _cache_key(provider, coordinates)

    cached = RouteDirectionsCache.objects.filter(
        cache_key=key,
        fetched_at__gte=timezone.now() - CACHE_TTL,
    ).first()
    if cached:
        return {
            'coordinates': cached.coordinates,
            'distance_m': cached.distance_m,
            'duration_s': cached.duration_s,
            'provider': cached.provider,
        }

    result = get_route_directions(coordinates)
    RouteDirectionsCache.objects.update_or_create(
        cache_key=key,
        defaults={
            'provider': result['provider'],
            'coordinates': result['coordinates'],
            'distance_m': result['distance_m'],
            'duration_s': result['duration_s'],
        },
    )
    return result
