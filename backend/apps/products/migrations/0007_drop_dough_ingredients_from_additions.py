from collections import defaultdict
from decimal import ROUND_HALF_UP, Decimal

from django.db import migrations

PRECISION = Decimal('0.001')


def _quantize(amount):
    return max(amount.quantize(PRECISION, rounding=ROUND_HALF_UP), PRECISION)


def drop_dough_ingredients(apps, schema_editor):
    """Dodatkiem może być tylko surowiec spoza ciasta — pozostałe usuwa i przelicza recepturę.

    Logika jest kopią production.services.recipes (compose) — migracja nie może zależeć od kodu,
    który się później zmieni.
    """
    ProductBakeSpec = apps.get_model('production', 'ProductBakeSpec')
    DoughIngredient = apps.get_model('production', 'DoughIngredient')
    Recipe = apps.get_model('products', 'Recipe')
    ProductAddition = apps.get_model('products', 'ProductAddition')

    for spec in ProductBakeSpec.objects.all():
        part = {
            item.ingredient_id: item.amount_per_kg * spec.piece_weight_kg
            for item in DoughIngredient.objects.filter(dough_id=spec.dough_id)
        }
        overlapping = ProductAddition.objects.filter(product_id=spec.product_id, ingredient_id__in=part)
        if not overlapping.exists():
            continue
        overlapping.delete()

        total = defaultdict(Decimal, part)
        for addition in ProductAddition.objects.filter(product_id=spec.product_id):
            total[addition.ingredient_id] += addition.amount
        Recipe.objects.filter(product_id=spec.product_id).delete()
        Recipe.objects.bulk_create([
            Recipe(product_id=spec.product_id, ingredient_id=ingredient_id, amount=_quantize(amount))
            for ingredient_id, amount in total.items()
            if amount > 0
        ])


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0006_derive_product_additions'),
    ]

    operations = [
        migrations.RunPython(drop_dough_ingredients, migrations.RunPython.noop),
    ]
