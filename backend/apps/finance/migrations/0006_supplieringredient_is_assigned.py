from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0005_recurringexpense_expense_recurring'),
    ]

    operations = [
        migrations.AddField(
            model_name='supplieringredient',
            name='is_assigned',
            field=models.BooleanField(default=True),
        ),
    ]
