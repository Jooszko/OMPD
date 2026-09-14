import time

from django.core.management.base import BaseCommand
from django.utils import timezone

from clients.models import Client
from clients.services.geocoding import GeocodingError, geocode_address

DEFAULT_DELAY = 1.1


class Command(BaseCommand):
    help = 'Geokoduje adresy klientów (lat/lng) przez Nominatim (OpenStreetMap).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--all',
            action='store_true',
            help='Geokoduj wszystkich klientów, nie tylko tych bez współrzędnych',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Nadpisz istniejące współrzędne (implikuje --all)',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='Maksymalna liczba klientów do przetworzenia',
        )
        parser.add_argument(
            '--delay',
            type=float,
            default=DEFAULT_DELAY,
            help=f'Opóźnienie między zapytaniami w sekundach (domyślnie {DEFAULT_DELAY}, limit Nominatim to 1/s)',
        )

    def handle(self, *args, **options):
        clients = Client.objects.all().order_by('client_id')
        if not (options['all'] or options['force']):
            clients = clients.filter(latitude__isnull=True)
        if options['limit']:
            clients = clients[:options['limit']]

        clients = list(clients)
        if not clients:
            self.stdout.write('Brak klientów do zgeokodowania.')
            return

        geocoded = 0
        skipped = 0
        failed = 0

        for i, client in enumerate(clients):
            if i > 0:
                time.sleep(options['delay'])

            if not client.address.strip():
                self.stdout.write(self.style.WARNING(f'{client.name}: brak adresu, pomijam.'))
                skipped += 1
                continue

            try:
                result = geocode_address(client.address)
            except GeocodingError as exc:
                self.stdout.write(self.style.ERROR(f'{client.name}: {exc}'))
                failed += 1
                continue

            if result is None:
                self.stdout.write(self.style.WARNING(f'{client.name}: nie znaleziono adresu "{client.address}".'))
                skipped += 1
                continue

            client.latitude, client.longitude = result
            client.geocoded_at = timezone.now()
            client.save(update_fields=['latitude', 'longitude', 'geocoded_at'])
            geocoded += 1
            self.stdout.write(f'{client.name}: {client.latitude}, {client.longitude}')

        self.stdout.write(self.style.SUCCESS(
            f'Gotowe: zgeokodowano {geocoded}, pominięto {skipped}, błędów {failed} (z {len(clients)}).'
        ))
