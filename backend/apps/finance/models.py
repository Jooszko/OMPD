from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from common.models import TimeStampedModel


class Supplier(models.Model):
    supplier_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=15, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    nip = models.CharField(max_length=13, blank=True, null=True)  # Nowe opcjonalne pole NIP
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

class SupplierIngredient(TimeStampedModel):
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='ingredients_catalog')
    ingredient = models.ForeignKey('products.Ingredient', on_delete=models.CASCADE, related_name='suppliers_catalog')
    supplier_part_no = models.CharField(max_length=50, blank=True, null=True) # Kod produktu u dostawcy
    last_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True) # Ostatnia cena
    is_assigned = models.BooleanField(default=True)

    class Meta:
        unique_together = ('supplier', 'ingredient')

    def __str__(self):
        return f"{self.supplier.name} -> {self.ingredient.name}"

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
    recurring = models.ForeignKey(
        'RecurringExpense', on_delete=models.SET_NULL, null=True, blank=True, related_name='expenses'
    )

    def __str__(self):
        return f"{self.get_category_display()} - {self.amount} PLN ({self.date})"
    

class RecurringExpense(TimeStampedModel):
    """Template of a monthly cost (rent, salaries) that adds an Expense on its day of the month."""

    recurring_id = models.AutoField(primary_key=True)
    category = models.CharField(max_length=20, choices=Expense.CATEGORY_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.CharField(max_length=255, blank=True, default='')
    day_of_month = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(31)],
        help_text='31 oznacza ostatni dzień miesiąca, także w krótszych miesiącach.',
    )
    is_active = models.BooleanField(default=True)
    last_generated_on = models.DateField(
        null=True, blank=True, help_text='Data ostatniego dodanego wydatku; wcześniejsze terminy są pomijane.'
    )
    created_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, related_name='recurring_expenses')

    def __str__(self):
        return f"{self.get_category_display()} - {self.amount} PLN co miesiąc ({self.day_of_month}.)"

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