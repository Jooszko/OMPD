from decimal import Decimal

from django.test import TestCase

from products.models import Ingredient, IngredientStock


class DashboardViewWarehouseStockTests(TestCase):
    def test_warehouse_stock_reflects_ingredient_stock_model(self):
        ingredient = Ingredient.objects.create(name='Mąka testowa', unit='kg')
        IngredientStock.objects.create(
            ingredient=ingredient,
            current_stock=Decimal('12.500'),
            min_stock_level=Decimal('5.000'),
        )

        response = self.client.get('/api/dashboard/')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        row = next(r for r in payload['warehouse_stock'] if r['name'] == 'Mąka testowa')
        self.assertEqual(row['current_stock'], '12.500')
        self.assertEqual(row['min_stock_level'], '5.000')
        self.assertEqual(row['unit'], 'kg')
