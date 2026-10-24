from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from common.models import TimeStampedModel
from pathlib import Path
from uuid import uuid4

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
    delivery_note = models.TextField(blank=True, default='')
    failure_reason = models.CharField(max_length=20, choices=FAILURE_REASON_CHOICES, blank=True, default='')
    failure_note = models.TextField(blank=True, default='')
    failed_at = models.DateTimeField(null=True, blank=True)
    assigned_route = models.ForeignKey(
        'clients.Route', on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_orders'
    )
    assigned_driver = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='driven_orders'
    )
    def __str__(self):
        return f"{self.order_date} - {self.client.name} ({self.status})"

def delivery_proof_upload_to(instance, filename):
    extension = Path(filename).suffix.lower() or '.jpg'
    return (
        f'delivery_proofs/{instance.order_date:%Y/%m/%d}/'
        f'{instance.client_id}_{instance.kind}_{uuid4().hex}{extension}'
    )

class DeliveryProof(TimeStampedModel):
    KIND_CHOICES = [
        ('photo', 'Zdjęcie'),
        ('signature', 'Podpis'),
    ]

    proof_id = models.AutoField(primary_key=True)
    client = models.ForeignKey('clients.Client', on_delete=models.CASCADE, related_name='delivery_proofs')
    order_date = models.DateField()
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    image = models.ImageField(upload_to=delivery_proof_upload_to)
    signer_name = models.CharField(max_length=100, blank=True, default='')
    uploaded_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='uploaded_proofs'
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['client', 'order_date', 'kind'], name='unique_delivery_proof_per_kind'),
        ]

    def __str__(self):
        return f'{self.order_date} - {self.client.name} ({self.kind})'


class ProductReturn(TimeStampedModel):
    return_id = models.AutoField(primary_key=True)
    client = models.ForeignKey('clients.Client', on_delete=models.CASCADE, related_name='product_returns')
    product = models.ForeignKey('products.Product', on_delete=models.CASCADE, related_name='returns')
    return_date = models.DateField()
    source_date = models.DateField()
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    recorded_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='recorded_returns'
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['client', 'product', 'return_date'], name='unique_product_return_per_day'),
            models.CheckConstraint(condition=models.Q(quantity__gt=0), name='product_return_quantity_positive'),
        ]

    def __str__(self):
        return f'{self.return_date} - {self.client.name}: zwrot {self.product.name} x{self.quantity}'


class StandingOrderRun(models.Model):
    order_date = models.DateField(primary_key=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Zamówienia ze stałych na {self.order_date}'