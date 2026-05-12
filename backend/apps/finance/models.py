from django.conf import settings
from django.db import models

from products.models import Ingredient


class SupplyPurchase(models.Model):
    ingredient = models.ForeignKey(Ingredient, on_delete=models.CASCADE, related_name='purchases')
    quantity = models.DecimalField(max_digits=10, decimal_places=3)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    purchase_date = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'supply_purchases'

    def __str__(self):
        return f'{self.ingredient} — {self.quantity} ({self.purchase_date:%Y-%m-%d})'


class Expense(models.Model):
    category = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True)
    date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='expenses',
    )

    class Meta:
        db_table = 'expenses'

    def __str__(self):
        return f'{self.category} — {self.amount} ({self.date})'


class DailyFinancialReport(models.Model):
    report_date = models.DateField(primary_key=True)
    total_revenue = models.DecimalField(max_digits=12, decimal_places=2)
    total_cogs = models.DecimalField(max_digits=12, decimal_places=2)
    total_operating_expenses = models.DecimalField(max_digits=12, decimal_places=2)
    net_profit = models.DecimalField(max_digits=12, decimal_places=2)
    is_finalized = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='financial_reports',
    )

    class Meta:
        db_table = 'daily_financial_reports'

    def __str__(self):
        return f'Raport {self.report_date} ({"zamknięty" if self.is_finalized else "otwarty"})'
