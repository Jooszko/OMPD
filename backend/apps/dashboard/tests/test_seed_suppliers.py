from django.test import TestCase

from finance.models import Supplier, SupplierIngredient
from dashboard.seed.products import create_ingredients
from common.losses import LOSS_BUFFER
from dashboard.seed.production import product_recipe
from dashboard.seed.products import PRODUCT_DATA
from dashboard.seed.suppliers import INGREDIENT_SUPPLY, create_supplier_ingredients, create_suppliers
from products.models import IngredientStock


class SeedSuppliersTests(TestCase):
    def setUp(self):
        self.ingredients = create_ingredients()

    def test_create_suppliers_creates_ten(self):
        suppliers = create_suppliers()

        self.assertEqual(len(suppliers), 10)
        self.assertEqual(Supplier.objects.count(), 10)
        self.assertEqual(Supplier.objects.filter(is_active=False).count(), 1)

    def test_create_supplier_ingredients_links_all_ingredients(self):
        suppliers = create_suppliers()

        links = create_supplier_ingredients(suppliers, self.ingredients)

        self.assertEqual(len(links), len(self.ingredients))
        self.assertEqual(SupplierIngredient.objects.count(), len(self.ingredients))

    def test_supplier_prices_become_warehouse_prices(self):
        links = create_supplier_ingredients(create_suppliers(), self.ingredients)

        for link in links:
            self.assertEqual(IngredientStock.objects.get(ingredient=link.ingredient).current_price, link.last_price)

    def test_ingredients_come_from_active_suppliers(self):
        links = create_supplier_ingredients(create_suppliers(), self.ingredients)

        self.assertTrue(all(link.supplier.is_active for link in links))

    def test_every_product_sells_above_its_ingredient_cost(self):
        for name, _category, price, _stock in PRODUCT_DATA:
            with self.subTest(product=name):
                cost = sum(amount * INGREDIENT_SUPPLY[i][1] for i, amount in product_recipe(name).items()) * LOSS_BUFFER
                # Surowce to w piekarni zwykle 15–45 % ceny wyrobu.
                self.assertLess(cost / price, 0.45)
