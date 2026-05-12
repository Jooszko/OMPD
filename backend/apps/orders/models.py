from django.db import models

from clients.models import Client
from products.models import Product


class StandingOrder(models.Model):
    DAY_CHOICES = [
        (0, 'Poniedziałek'),
        (1, 'Wtorek'),
        (2, 'Środa'),
        (3, 'Czwartek'),
        (4, 'Piątek'),
        (5, 'Sobota'),
        (6, 'Niedziela'),
    ]

    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='standing_orders')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='standing_orders')
    day_of_week = models.IntegerField(choices=DAY_CHOICES)
    quantity = models.IntegerField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'standing_orders'

    def __str__(self):
        return f'{self.client} — {self.product} ({self.get_day_of_week_display()})'


class DailyOrder(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Oczekuje'),
        ('confirmed', 'Potwierdzone'),
        ('delivered', 'Dostarczone'),
        ('cancelled', 'Anulowane'),
    ]

    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='daily_orders')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='daily_orders')
    order_date = models.DateField()
    quantity = models.IntegerField()
    price_at_sale = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'daily_orders'

    def __str__(self):
        return f'{self.client} — {self.product} ({self.order_date})'
