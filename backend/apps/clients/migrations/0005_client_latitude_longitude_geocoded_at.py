from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('clients', '0004_client_nip'),
    ]

    operations = [
        migrations.AddField(
            model_name='client',
            name='latitude',
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name='client',
            name='longitude',
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name='client',
            name='geocoded_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
