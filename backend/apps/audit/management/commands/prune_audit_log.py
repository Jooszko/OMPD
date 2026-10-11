from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from audit.models import AuditEntry

MIN_RETENTION_DAYS = 30


class Command(BaseCommand):
    help = 'Usuwa wpisy dziennika zmian starsze niż podana liczba dni.'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=365, help='Ile dni wpisów zachować (domyślnie 365).')
        parser.add_argument('--dry-run', action='store_true', help='Tylko policz wpisy do usunięcia.')

    def handle(self, *args, **options):
        days = options['days']
        if days < MIN_RETENTION_DAYS:
            raise CommandError(f'Dziennik musi przechowywać wpisy z co najmniej {MIN_RETENTION_DAYS} dni.')

        cutoff = timezone.now() - timedelta(days=days)
        old_entries = AuditEntry.objects.filter(created_at__lt=cutoff)

        if options['dry_run']:
            self.stdout.write(f'Do usunięcia: {old_entries.count()} wpisów starszych niż {cutoff:%d.%m.%Y}.')
            return

        deleted, _ = old_entries.delete()
        self.stdout.write(self.style.SUCCESS(f'Usunięto {deleted} wpisów starszych niż {cutoff:%d.%m.%Y}.'))