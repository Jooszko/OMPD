from django.test import TestCase

from products.models import Ingredient, IngredientStock, Product, Recipe
from dashboard.seed.products import create_ingredients, create_products


class SeedProductsTests(TestCase):
    def test_create_ingredients_creates_twenty_with_stock(self):
        ingredients = create_ingredients()

        self.assertEqual(len(ingredients), 20)
        self.assertEqual(Ingredient.objects.count(), 20)
        self.assertEqual(IngredientStock.objects.count(), 20)

    def test_some_ingredients_below_min_stock(self):
        create_ingredients()

        below_min = [
            stock for stock in IngredientStock.objects.select_related('ingredient')
            if stock.current_stock < stock.min_stock_level
        ]
        self.assertGreaterEqual(len(below_min), 2)

    def test_create_ingredients_is_idempotent(self):
        create_ingredients()
        create_ingredients()

        self.assertEqual(Ingredient.objects.count(), 20)
        self.assertEqual(IngredientStock.objects.count(), 20)

    def test_create_products_creates_twenty_with_recipes(self):
        ingredients = create_ingredients()

        products = create_products(ingredients)

        self.assertEqual(len(products), 20)
        self.assertEqual(Product.objects.count(), 20)
        self.assertGreater(Recipe.objects.count(), 20)
        bread = Product.objects.get(name='Chleb pszenny 500g')
        self.assertEqual(bread.recipe_set.count(), 4)
