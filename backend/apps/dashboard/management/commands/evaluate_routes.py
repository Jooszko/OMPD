import csv
import random
from datetime import date

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Max, Min

from orders.models import DailyOrder
from dashboard.services.route_evaluation import (
    MAX_OPTIMAL_STOPS, METHODS, evaluate_day, route_days, summarize,
)


def _point(value):
    try:
        lat, lng = (float(part) for part in value.split(','))
    except ValueError:
        raise CommandError('Punkt startu podaj jako "szerokość,długość", np. "49.7986,18.7864".')
    return lat, lng


def _decimal(value, digits=2):
    return '' if value is None else f'{value:.{digits}f}'.replace('.', ',')


class Command(BaseCommand):
    help = (
        'Porównuje długość dziennych tras przy różnych kolejnościach przystanków: alfabetycznej, losowej, '
        'najbliższego sąsiada, najbliższego sąsiada z 2-opt (jak w aplikacji) i optymalnej (Held-Karp). '
        'Niczego nie zapisuje w bazie.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--start', type=date.fromisoformat, default=None,
                            help='Pierwszy dzień w formacie RRRR-MM-DD (domyślnie najwcześniejsze zamówienie)')
        parser.add_argument('--end', type=date.fromisoformat, default=None,
                            help='Ostatni dzień w formacie RRRR-MM-DD (domyślnie dzisiaj)')
        parser.add_argument('--depot', type=_point, default=None,
                            help='Punkt startu (piekarnia) jako "szerokość,długość"; bez niego trasa startuje '
                                 'od pierwszego klienta alfabetycznie, tak jak w aplikacji')
        parser.add_argument('--samples', type=int, default=100,
                            help='Liczba losowań dla kolejności losowej (domyślnie 100)')
        parser.add_argument('--seed', type=int, default=42,
                            help='Ziarno losowania, aby wynik był powtarzalny (domyślnie 42)')
        parser.add_argument('--output', default=None,
                            help='Ścieżka pliku CSV z wynikiem każdej trasy (średniki, przecinek dziesiętny)')

    def handle(self, *args, **options):
        bounds = DailyOrder.objects.aggregate(first=Min('order_date'), last=Max('order_date'))
        if bounds['first'] is None:
            raise CommandError('Brak zamówień w bazie.')
        start = options['start'] or bounds['first']
        end = options['end'] or min(bounds['last'], date.today())
        if start > end:
            raise CommandError('Data początkowa nie może być późniejsza niż końcowa.')

        rng = random.Random(options['seed'])
        days = route_days(start, end, options['depot'])
        results = [evaluate_day(day, options['samples'], rng) for day in days]
        summary = summarize(results)
        if not summary:
            raise CommandError('Brak tras do oceny w tym okresie.')

        evaluated = [r for r in results if r['optimal_km'] is not None]
        stops = [r['stops'] for r in evaluated]
        self.stdout.write(f'Okres: {start} – {end}')
        self.stdout.write(f'Start trasy: {"piekarnia " + str(options["depot"]) if options["depot"] else "pierwszy klient alfabetycznie"}')
        self.stdout.write(
            f'Ocenione trasy: {len(evaluated)} (przystanki: najmniej {min(stops)}, '
            f'średnio {_decimal(sum(stops) / len(stops), 1)}, najwięcej {max(stops)})'
        )
        skipped = len(results) - len(evaluated)
        if skipped:
            self.stdout.write(f'Pominięte trasy powyżej {MAX_OPTIMAL_STOPS} przystanków: {skipped}')
        self.stdout.write('')
        self.stdout.write(f'{"Kolejność":<40}{"Śr. km":>9}{"Oszczędność":>14}{"Od optimum":>13}')
        for row in summary:
            self.stdout.write(
                f'{row["label"]:<40}{_decimal(row["mean_km"]):>9}'
                f'{_decimal(row["saving_pct"], 1) + "%":>14}{_decimal(row["gap_pct"], 1) + "%":>13}'
            )

        if options['output']:
            with open(options['output'], 'w', newline='', encoding='utf-8-sig') as handle:
                writer = csv.writer(handle, delimiter=';')
                writer.writerow(['data', 'trasa', 'przystanki', *(f'{m}_km' for m in METHODS)])
                for r in results:
                    writer.writerow([
                        r['date'].isoformat(), r['route'], r['stops'],
                        *(_decimal(r[f'{m}_km'], 3) for m in METHODS),
                    ])
            self.stdout.write(self.style.SUCCESS(f'Zapisano {len(results)} tras do pliku {options["output"]}.'))