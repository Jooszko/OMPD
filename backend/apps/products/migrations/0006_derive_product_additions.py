from collections import defaultdict
from decimal import ROUND_HALF_UP, Decimal

from django.db import migrations

PRECISION = Decimal('0.001')


def _round(amount):
    return amount.quantize(PRECISION, rounding=ROUND_HALF_UP)


def _quantize(amount):
    return max(_round(amount), PRECISION)


def derive_additions(apps, schema_editor):
    """Dla wyrobów z ciastem: dodatki = obecna receptura minus część z ciasta, potem receptura od nowa.

    Logika jest kopią production.services.recipes (surplus_over_dough, compose) — migracja nie może
    zależeć od kodu, który się później zmieni. Surowce z ciasta z nadwyżką do 0,001 traktuje jako
    błąd zaokrąglenia, a ilości mniejsze niż część z ciasta uzupełnia do pełnej części z ciasta.
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
        current = {r.ingredient_id: r.amount for r in Recipe.objects.filter(product_id=spec.product_id)}

        additions = {}
        for ingredient_id, amount in current.items():
            extra = amount - part.get(ingredient_id, Decimal('0'))
            tolerance = PRECISION if ingredient_id in part else Decimal('0')
            if extra > tolerance and _round(extra) > 0:
                additions[ingredient_id] = _round(extra)

        ProductAddition.objects.filter(product_id=spec.product_id).delete()
        ProductAddition.objects.bulk_create([
            ProductAddition(product_id=spec.product_id, ingredient_id=ingredient_id, amount=amount)
            for ingredient_id, amount in additions.items()
        ])

        total = defaultdict(Decimal)
        for source in (part, additions):
            for ingredient_id, amount in source.items():
                total[ingredient_id] += amount
        Recipe.objects.filter(product_id=spec.product_id).delete()
        Recipe.objects.bulk_create([
            Recipe(product_id=spec.product_id, ingredient_id=ingredient_id, amount=_quantize(amount))
            for ingredient_id, amount in total.items()
            if amount > 0
        ])


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0005_productaddition'),
        ('production', '0003_shared_loss_buffer'),
    ]

    operations = [
        migrations.RunPython(derive_additions, migrations.RunPython.noop),
    ]
