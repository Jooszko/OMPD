from django.core.management.base import BaseCommand

from products.stock import USAGE_WINDOW_DAYS, recalculate_min_stock


class Command(BaseCommand):
    help = (
        f'Przelicza próg minimalny każdego surowca jako sumę zużycia w produkcji z ostatnich '
        f'{USAGE_WINDOW_DAYS} dni. Uruchamiane codziennie z crona, bo okno przesuwa się także w dni bez produkcji.'
    )

    def handle(self, *args, **options):
        changed = recalculate_min_stock()
        self.stdout.write(self.style.SUCCESS(f'Zaktualizowano próg minimalny {changed} surowców.'))
