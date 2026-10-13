from django.core.management.base import BaseCommand

from finance.recurring import materialize_due_expenses


class Command(BaseCommand):
    help = 'Dodaje zaległe wydatki cykliczne (czynsz, wynagrodzenia) do dnia dzisiejszego.'

    def handle(self, *args, **options):
        created = materialize_due_expenses()
        self.stdout.write(self.style.SUCCESS(f'Dodano wydatków cyklicznych: {created}.'))