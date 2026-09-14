import json
import urllib.error
import urllib.parse
import urllib.request
from decimal import Decimal

NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
USER_AGENT = 'OMPD-bakery-erp/1.0 (geocode_clients management command)'


class GeocodingError(Exception):
    pass


def geocode_address(address: str, *, country_codes: str = 'pl', timeout: int = 10) -> tuple[Decimal, Decimal] | None:
    """Look up an address and return (latitude, longitude), or None if no match."""
    params = {
        'q': address,
        'format': 'jsonv2',
        'limit': 1,
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

    if not results:
        return None

    try:
        return Decimal(results[0]['lat']), Decimal(results[0]['lon'])
    except (KeyError, ValueError) as exc:
        raise GeocodingError(f'Nieoczekiwany format odpowiedzi serwisu geokodowania: {exc}') from exc
