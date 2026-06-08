from django.db import models

class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

class StandingOrder(TimeStampedModel):
    so_id = models.AutoField(primary_key=True)
    client = models.ForeignKey('clients.Client', on_delete=models.CASCADE, related_name='standing_orders')
    product = models.ForeignKey('products.Product', on_delete=models.CASCADE, related_name='standing_orders')
    day_of_week = models.IntegerField()
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
        ('cancelled', 'Anulowane'),
    ]
    do_id = models.AutoField(primary_key=True)
    client = models.ForeignKey('clients.Client', on_delete=models.CASCADE, related_name='daily_orders')
    product = models.ForeignKey('products.Product', on_delete=models.CASCADE, related_name='daily_orders')
    order_date = models.DateField()
    quantity = models.IntegerField()
    price_at_sale = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='planned')

    def __str__(self):
        return f"{self.order_date} - {self.client.name} ({self.status})"