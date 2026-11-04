from datetime import date
from decimal import Decimal

from django.test import TestCase

from production.models import ProductBakeSpec
from products.models import Ingredient, IngredientStock, Product, Recipe
from dashboard.seed.dates import build_date_range
from dashboard.seed.production import DOUGH_DATA, create_production_setup, product_recipe
from dashboard.seed.products import INGREDIENT_DATA, PRODUCT_DATA, create_ingredients, create_products, create_stock_history


class SeedProductsTests(TestCase):
    def test_create_ingredients_creates_all_with_stock(self):
        ingredients = create_ingredients()

        self.assertEqual(len(ingredients), len(INGREDIENT_DATA))
        self.assertEqual(Ingredient.objects.count(), len(INGREDIENT_DATA))
        self.assertEqual(IngredientStock.objects.count(), len(INGREDIENT_DATA))

    def test_some_ingredients_below_min_stock(self):
        ingredients = create_ingredients()
        create_stock_history(ingredients, build_date_range(date.today(), 30), user=None)

        below_min = [
            stock for stock in IngredientStock.objects.select_related('ingredient')
            if stock.current_stock < stock.min_stock_level
        ]
        self.assertGreaterEqual(len(below_min), 2)

    def test_create_ingredients_is_idempotent(self):
        create_ingredients()
        create_ingredients()

        self.assertEqual(Ingredient.objects.count(), len(INGREDIENT_DATA))
        self.assertEqual(IngredientStock.objects.count(), len(INGREDIENT_DATA))

    def test_create_products_creates_all_with_recipes(self):
        ingredients = create_ingredients()

        products = create_products(ingredients)

        self.assertEqual(len(products), len(PRODUCT_DATA))
        self.assertEqual(Product.objects.count(), len(PRODUCT_DATA))
        self.assertFalse(Product.objects.filter(category='pastry').exists())
        bread = Product.objects.get(name='Chleb pszenny 500g')
        self.assertEqual(bread.recipe_set.count(), 4)

    def test_every_product_has_a_dough_and_a_recipe_derived_from_it(self):
        ingredients = create_ingredients()
        products = create_products(ingredients)

        create_production_setup(ingredients, products)

        self.assertEqual(ProductBakeSpec.objects.count(), len(PRODUCT_DATA))
        for product in Product.objects.select_related('bake_spec__dough'):
            spec = product.bake_spec
            recipe = {r.ingredient.name: r.amount for r in Recipe.objects.filter(product=product).select_related('ingredient')}
            dough_ingredients = set(spec.dough.dough_ingredients.values_list('ingredient__name', flat=True))
            self.assertTrue(dough_ingredients <= set(recipe), product.name)
            self.assertEqual(recipe, product_recipe(product.name))
            flour = sum(amount for name, amount in recipe.items() if name.startswith('Mąka'))
            self.assertGreater(flour, spec.piece_weight_kg * Decimal('0.45'), product.name)

    def test_dough_recipes_add_up_to_one_kilogram(self):
        egg_kg = Decimal('0.05')
        for name, *_, recipe in DOUGH_DATA:
            mass = sum(amount * egg_kg if ingredient == 'Jaja' else amount for ingredient, amount in recipe)
            self.assertAlmostEqual(mass, Decimal('1'), delta=Decimal('0.002'), msg=name)
