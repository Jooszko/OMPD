from django.core.management.base import BaseCommand, CommandError

from dashboard.services.route_evaluation import benchmark


def _sizes(value):
    try:
        sizes = [int(part) for part in value.split(',')]
    except ValueError:
        raise CommandError('Liczby przystanków podaj po przecinku, np. "7,10,12,14,16".')
    if any(size < 3 for size in sizes):
        raise CommandError('Każda trasa musi mieć co najmniej 3 przystanki.')
    return sizes


def _decimal(value, digits):
    return f'{value:.{digits}f}'.replace('.', ',')


class Command(BaseCommand):
    help = (
        'Mierzy czas i pamięć algorytmu Helda-Karpa oraz czas metody stosowanej w aplikacji '
        '(najbliższy sąsiad + 2-opt) dla losowych tras o zadanej liczbie przystanków. Nie korzysta z bazy.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--sizes', type=_sizes, default=[7, 10, 12, 14, 16],
                            help='Liczby przystanków po przecinku (domyślnie 7,10,12,14,16)')
        parser.add_argument('--seed', type=int, default=1,
                            help='Ziarno losowania punktów (domyślnie 1)')
        parser.add_argument('--repeats', type=int, default=3,
                            help='Ile razy powtórzyć pomiar czasu; liczy się najlepszy wynik (domyślnie 3)')

    def handle(self, *args, **options):
        rows = benchmark(options['sizes'], options['seed'], options['repeats'])
        self.stdout.write(f'{"Przystanki":>10}{"Held-Karp [s]":>16}{"Held-Karp [MB]":>17}{"2-opt [ms]":>13}')
        for row in rows:
            self.stdout.write(
                f'{row["stops"]:>10}{_decimal(row["optimal_s"], 3):>16}'
                f'{_decimal(row["optimal_mb"], 1):>17}{_decimal(row["two_opt_s"] * 1000, 2):>13}'
            )