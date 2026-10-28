from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0006_supplieringredient_is_assigned'),
    ]

    operations = [
        migrations.DeleteModel(
            name='SupplyOrderItem',
        ),
        migrations.DeleteModel(
            name='SupplyOrder',
        ),
    ]
