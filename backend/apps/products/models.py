from django.db import models


class Product(models.Model):
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=100)
    base_price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = 'products'

    def __str__(self):
        return self.name


class Ingredient(models.Model):
    name = models.CharField(max_length=255)
    unit = models.CharField(max_length=50)
    current_stock = models.DecimalField(max_digits=10, decimal_places=3)
    min_stock_level = models.DecimalField(max_digits=10, decimal_places=3)

    class Meta:
        db_table = 'ingredients'

    def __str__(self):
        return f'{self.name} ({self.unit})'


class Recipe(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='recipe_items')
    ingredient = models.ForeignKey(Ingredient, on_delete=models.CASCADE, related_name='used_in_recipes')
    amount = models.DecimalField(max_digits=10, decimal_places=3)

    class Meta:
        db_table = 'recipes'
        unique_together = ('product', 'ingredient')

    def __str__(self):
        return f'{self.product} — {self.ingredient} x{self.amount}'
