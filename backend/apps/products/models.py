from django.db import models
from django.utils import timezone
from common.models import TimeStampedModel

class Ingredient(TimeStampedModel):
    ingredient_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    unit = models.CharField(max_length=10) 

    def __str__(self):
        return f"{self.name} ({self.unit})"
    
class IngredientStock(models.Model):
    ingredient = models.OneToOneField(
        Ingredient, 
        on_delete=models.CASCADE, 
        primary_key=True, 
        related_name='stock'
    )
    current_stock = models.DecimalField(max_digits=10, decimal_places=3, default=0.000)
    min_stock_level = models.DecimalField(max_digits=10, decimal_places=3, default=0.000)
    current_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Magazyn: {self.ingredient.name} - {self.current_stock} {self.ingredient.unit}"


class StockMovement(models.Model):
    """Każda zmiana stanu surowca: przyjęcie, rozchód, inwentaryzacja albo zużycie w produkcji."""
    KIND_INITIAL = 'initial'
    KIND_DELIVERY = 'delivery'
    KIND_PRODUCTION = 'production'
    KIND_LOSS = 'loss'
    KIND_COUNT = 'count'
    KIND_CHOICES = [
        (KIND_INITIAL, 'Stan początkowy'),
        (KIND_DELIVERY, 'Przyjęcie dostawy'),
        (KIND_PRODUCTION, 'Zużycie w produkcji'),
        (KIND_LOSS, 'Rozchód / strata'),
        (KIND_COUNT, 'Inwentaryzacja'),
    ]

    movement_id = models.AutoField(primary_key=True)
    ingredient = models.ForeignKey(Ingredient, on_delete=models.CASCADE, related_name='movements')
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    balance_after = models.DecimalField(max_digits=12, decimal_places=3)
    note = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='stock_movements'
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['created_at', 'movement_id']
        indexes = [models.Index(fields=['ingredient', 'created_at'], name='stock_movement_time')]

    def __str__(self):
        return f"{self.get_kind_display()}: {self.ingredient.name} {self.quantity:+}"


class Product(models.Model):
    PRODUCT_CATEGORY_CHOICES = [
        ('bread', 'Chleby'),
        ('buns', 'Bułki/Drożdżówki'),
        ('pastry', 'Wyroby cukiernicze'),
        ('other', 'Inne'),
    ]
    product_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    category = models.CharField(max_length=20, choices=PRODUCT_CATEGORY_CHOICES, default='bread')
    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    current_stock = models.IntegerField(default=0)
    ingredients = models.ManyToManyField(Ingredient, through='Recipe')

    def __str__(self):
        return self.name
    
class Recipe(models.Model):
    recipe_id = models.AutoField(primary_key=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    ingredient = models.ForeignKey(Ingredient, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=3)

    class Meta:
        unique_together = ('product', 'ingredient')

    def __str__(self):
        return f"{self.amount} <- {self.ingredient.name} ({self.product.name})"