import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

from django.core.cache import cache

NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
USER_AGENT = 'OMPD-bakery-erp/1.0'
MIN_INTERVAL_SECONDS = 1.1
SEARCH_LIMIT = 5
LAST_CALL_KEY = 'geocoding:last-call'
COORDINATE_QUANTUM = Decimal('0.000001')


class GeocodingError(Exception):
    pass


@dataclass(frozen=True)
class GeocodeMatch:
    latitude: Decimal
    longitude: Decimal
    label: str

def _town(address):
    parts = [part.strip().lower() for part in address.split(',') if part.strip()]
    return parts[-1] if len(parts) > 1 else None


def _in_town(result, town):
    return town is None or town in [part.strip().lower() for part in result.get('display_name', '').split(',')]

def lookup_address(address: str, *, country_codes: str = 'pl', timeout: int = 10) -> GeocodeMatch | None:
    params = {
        'q': address,
        'format': 'jsonv2',
        'limit': SEARCH_LIMIT,
        'countrycodes': country_codes,
    }
    url = f'{NOMINATIM_URL}?{urllib.parse.urlencode(params)}'
    request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            results = json.load(response)
    except (urllib.error.URLError, TimeoutError) as exc:
        raise GeocodingError(f'Nie udało się połączyć z serwisem geokodowania: {exc}') from exc
    except json.JSONDecodeError as exc:
        raise GeocodingError(f'Nieprawidłowa odpowiedź serwisu geokodowania: {exc}') from exc

    town = _town(address)
    try:
        for result in results:
            if _in_town(result, town):
                latitude = Decimal(result['lat']).quantize(COORDINATE_QUANTUM, rounding=ROUND_HALF_UP)
                longitude = Decimal(result['lon']).quantize(COORDINATE_QUANTUM, rounding=ROUND_HALF_UP)
                return GeocodeMatch(latitude, longitude, result.get('display_name', ''))
    except (KeyError, ValueError, AttributeError) as exc:
        raise GeocodingError(f'Nieoczekiwany format odpowiedzi serwisu geokodowania: {exc}') from exc
    return None


def geocode_address(address: str, **options) -> tuple[Decimal, Decimal] | None:
    """Look up an address and return (latitude, longitude), or None if no match."""
    match = lookup_address(address, **options)
    return None if match is None else (match.latitude, match.longitude)


def wait_for_turn():
    last_call = cache.get(LAST_CALL_KEY)
    if last_call is not None:
        delay = MIN_INTERVAL_SECONDS - (time.time() - last_call)
        if delay > 0:
            time.sleep(delay)
    cache.set(LAST_CALL_KEY, time.time(), 60)