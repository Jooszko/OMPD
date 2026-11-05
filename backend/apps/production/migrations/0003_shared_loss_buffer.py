from decimal import Decimal

from django.db import migrations

# Wartość z common.losses w chwili tej migracji (LOSS_BUFFER = 1,05).
SHARED_LOSS_BUFFER_PCT = Decimal('5.00')


def use_shared_buffer(apps, schema_editor):
    """Bufor ciasta jest odtąd wspólny z finansami — ustawia go we wszystkich istniejących ciastach.

    Zapisane plany i dzieże nie zmieniają się: przechowują własne masy i odważki.
    """
    Dough = apps.get_model('production', 'Dough')
    Dough.objects.exclude(loss_buffer_pct=SHARED_LOSS_BUFFER_PCT).update(loss_buffer_pct=SHARED_LOSS_BUFFER_PCT)


class Migration(migrations.Migration):

    dependencies = [
        ('production', '0002_alter_dough_loss_buffer_pct'),
    ]

    operations = [
        migrations.RunPython(use_shared_buffer, migrations.RunPython.noop),
    ]
