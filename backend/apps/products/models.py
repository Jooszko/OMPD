from django.db import models

class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

class Ingredient(TimeStampedModel):
    ingredient_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    unit = models.CharField(max_length=10)
    current_stock = models.DecimalField(max_digits=10, decimal_places=3)
    min_stock_level = models.DecimalField(max_digits=10, decimal_places=3)

    def __str__(self):
        return f"{self.name} ({self.unit})"
    
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

    def __str__(self):
        return f"{self.amount} <- {self.ingredient.name} ({self.amount})"