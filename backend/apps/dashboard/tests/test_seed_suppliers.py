from django.test import TestCase

from finance.models import Supplier, SupplierIngredient
from dashboard.seed.products import create_ingredients
from dashboard.seed.suppliers import create_supplier_ingredients, create_suppliers


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

        self.assertEqual(len(links), 20)
        self.assertEqual(SupplierIngredient.objects.count(), 20)
