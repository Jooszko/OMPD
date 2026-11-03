from django.db import migrations, models
from django.db.models import Avg


def fill_current_price(apps, schema_editor):
    IngredientStock = apps.get_model('products', 'IngredientStock')
    SupplierIngredient = apps.get_model('finance', 'SupplierIngredient')
    prices = (
        SupplierIngredient.objects
        .filter(is_assigned=True, last_price__isnull=False)
        .values('ingredient_id')
        .annotate(avg_price=Avg('last_price'))
    )
    for row in prices:
        IngredientStock.objects.filter(ingredient_id=row['ingredient_id']).update(
            current_price=round(row['avg_price'], 2)
        )


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0003_stock_movement'),
        ('finance', '0007_delete_supply_orders'),
    ]

    operations = [
        migrations.AddField(
            model_name='ingredientstock',
            name='current_price',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.RunPython(fill_current_price, migrations.RunPython.noop),
    ]
