from datetime import date

from django.test import TestCase

from finance.models import Supplier, SupplierIngredient, SupplyOrder, SupplyOrderItem
from users.models import User
from dashboard.seed.dates import build_date_range
from dashboard.seed.products import create_ingredients
from dashboard.seed.suppliers import (
    create_supplier_ingredients,
    create_suppliers,
    create_supply_orders,
)


class SeedSuppliersTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin_test', password='x', role='admin', full_name='Admin Test'
        )
        self.ingredients = create_ingredients()
        self.date_range = build_date_range(date(2026, 7, 8))

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

    def test_create_supply_orders_creates_orders_with_items(self):
        suppliers = create_suppliers()
        links = create_supplier_ingredients(suppliers, self.ingredients)

        orders = create_supply_orders(suppliers, links, self.admin, self.date_range)

        self.assertEqual(len(orders), 25)
        self.assertEqual(SupplyOrder.objects.count(), 25)
        self.assertGreater(SupplyOrderItem.objects.count(), 25)
        for order in orders:
            self.assertTrue(order.items.exists())
