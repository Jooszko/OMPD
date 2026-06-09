from django.db import models
from common.models import TimeStampedModel

class Supplier(models.Model):
    supplier_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=15, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)

    def __str__(self):
        return self.name
    

class SupplyOrder(TimeStampedModel):
    STATUS_CHOICES = [
        ('ordered', 'Zamówione'),
        ('partially_received', 'Częściowo dostarczone'),
        ('completed', 'Przyjęte'),
        ('cancelled', 'Anulowane'),
    ]
    supply_order_id = models.AutoField(primary_key=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='supply_orders')
    order_date = models.DateTimeField()
    expected_delivery_date = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ordered')
    created_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, related_name='supply_orders')

    def __str__(self):
        return f"Zamówienie nr {self.supply_order_id} - {self.supplier.name} ({self.status})"
    

class SupplyOrderItem(models.Model):
    item_id = models.AutoField(primary_key=True)
    supply_order = models.ForeignKey(SupplyOrder, on_delete=models.CASCADE, related_name='items')
    ingredient = models.ForeignKey('products.Ingredient', on_delete=models.CASCADE, related_name='order_items')
    quantity_ordered = models.DecimalField(max_digits=10, decimal_places=3)
    quantity_received = models.DecimalField(max_digits=10, decimal_places=3, default=0.000)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"Pozycja {self.item_id} w zamówieniu {self.supply_order_id}"
   

class Expense(TimeStampedModel):
    CATEGORY_CHOICES = [
        ('fuel', 'Paliwo'),
        ('utility', 'Media'),
        ('salary', 'Wynagrodzenia'),
        ('rent', 'Czynsz'),
        ('other', 'Inne'),
    ]
    expense_id = models.AutoField(primary_key=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True)
    date = models.DateField()
    created_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, related_name='expenses')

    def __str__(self):
        return f"{self.get_category_display()} - {self.amount} PLN ({self.date})"
    

class DailyFinancialReport(TimeStampedModel):
    report_date = models.DateField(primary_key=True)
    total_revenue = models.DecimalField(max_digits=12, decimal_places=2)
    total_cogs = models.DecimalField(max_digits=12, decimal_places=2)
    total_operating_expenses = models.DecimalField(max_digits=12, decimal_places=2)
    net_profit = models.DecimalField(max_digits=12, decimal_places=2)
    is_finalized = models.BooleanField(default=False)
    generated_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, related_name='financial_reports')
    
    def __str__(self):
        return f"Raport {self.report_date} - Zysk: {self.net_profit} PLN"