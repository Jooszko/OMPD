from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from common.models import TimeStampedModel

class StandingOrder(TimeStampedModel):
    DAYS_CHOICES = [
        (0, 'Pn'),
        (1, 'Wt'),
        (2, ' Śr'),
        (3, 'Czw'),
        (4, 'Pt'),
        (5, 'Sb'),
        (6, 'Nd'),
    ]

    so_id = models.AutoField(primary_key=True)
    client = models.ForeignKey('clients.Client', on_delete=models.CASCADE, related_name='standing_orders')
    product = models.ForeignKey('products.Product', on_delete=models.CASCADE, related_name='standing_orders')
    day_of_week = models.IntegerField(choices=DAYS_CHOICES, validators=[MinValueValidator(0),MaxValueValidator(6)], help_text="0 = Monday, 6 = Sunday")
    quantity = models.IntegerField()
    price_at_sale = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        dni = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"]
        return f"[Szablon] {self.client.name} - {dni[self.day_of_week-1]}: {self.product.name}"
    
class DailyOrder(TimeStampedModel):
    STATUS_CHOICES = [
        ('planned', 'Zaplanowane'),
        ('in_production', 'W produkcji'),
        ('in_delivery', 'W dostawie'),
        ('delivered', 'Dostarczone'),
        ('failed', 'Nieudana dostawa'),
        ('cancelled', 'Anulowane'),
    ]
    FAILURE_REASON_CHOICES = [
        ('closed', 'Klient zamknięty'),
        ('refused', 'Odmowa przyjęcia'),
        ('no_access', 'Brak dojazdu / dostępu'),
        ('other', 'Inny powód'),
    ]
    NON_REVENUE_STATUSES = ['failed', 'cancelled']
    do_id = models.AutoField(primary_key=True)
    client = models.ForeignKey('clients.Client', on_delete=models.CASCADE, related_name='daily_orders')
    product = models.ForeignKey('products.Product', on_delete=models.CASCADE, related_name='daily_orders')
    order_date = models.DateField()
    quantity = models.IntegerField()
    price_at_sale = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='planned')
    delivered_at = models.DateTimeField(null=True, blank=True)
    failure_reason = models.CharField(max_length=20, choices=FAILURE_REASON_CHOICES, blank=True, default='')
    failure_note = models.TextField(blank=True, default='')
    failed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.order_date} - {self.client.name} ({self.status})"