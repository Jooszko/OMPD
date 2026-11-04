from datetime import date
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from audit.models import AuditEntry
from clients.models import Client, Route
from finance.models import Supplier, SupplierIngredient
from orders.models import DailyOrder, ProductReturn
from products.models import Ingredient, IngredientStock, Product, Recipe
from users.models import User

URL = '/api/finance/profitability/'
PERIOD = {'start': '2026-09-01', 'end': '2026-09-30'}


class ProfitabilityTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(User.objects.create_user(username='admin_prof', password='x', role='admin', full_name='A'))
        route = Route.objects.create(route_name='Trasa Prof')
        self.shop = Client.objects.create(name='Sklep Prof', address='Adres', route=route)
        self.flour = Ingredient.objects.create(name='Mąka', unit='kg')
        self.butter = Ingredient.objects.create(name='Masło', unit='kg')
        self.mill = Supplier.objects.create(name='Młyn')
        self.dairy = Supplier.objects.create(name='Mleczarnia')
        SupplierIngredient.objects.create(supplier=self.mill, ingredient=self.flour, last_price=Decimal('9.00'))
        SupplierIngredient.objects.create(supplier=self.dairy, ingredient=self.butter, last_price=Decimal('30.00'))
        IngredientStock.objects.create(ingredient=self.flour, current_price=Decimal('4.00'))
        IngredientStock.objects.create(ingredient=self.butter)

        self.bread = Product.objects.create(name='Chleb', category='bread', base_price=Decimal('8.00'))
        Recipe.objects.create(product=self.bread, ingredient=self.flour, amount=Decimal('0.500'))
        self.challah = Product.objects.create(name='Chałka', category='bread', base_price=Decimal('6.00'))
        Recipe.objects.create(product=self.challah, ingredient=self.flour, amount=Decimal('0.250'))
        Recipe.objects.create(product=self.challah, ingredient=self.butter, amount=Decimal('0.100'))
        self.cookie = Product.objects.create(name='Ciastko', category='pastry', base_price=Decimal('3.00'))

    def order(self, product, quantity, status='delivered', day=date(2026, 9, 10)):
        DailyOrder.objects.create(
            client=self.shop, product=product, order_date=day, quantity=quantity,
            price_at_sale=product.base_price, status=status,
        )

    def products(self):
        return {p['name']: p for p in self.api.get(URL, PERIOD).data['products']}

    def test_unit_margin_comes_from_recipe_and_warehouse_price(self):
        bread = self.products()['Chleb']

        self.assertEqual((bread['unit_cost'], bread['unit_margin'], bread['margin_pct']), ('2.10', '5.90', 73.8))
        self.assertEqual(bread['missing_prices'], [])

    def test_period_margin_uses_sales_returns_and_baked_quantity(self):
        self.order(self.bread, 10)
        self.order(self.bread, 2, status='failed')
        self.order(self.bread, 5, status='cancelled')
        self.order(self.bread, 3, day=date(2026, 10, 1))
        ProductReturn.objects.create(
            client=self.shop, product=self.bread, return_date=date(2026, 9, 11), source_date=date(2026, 9, 10),
            quantity=1, unit_price=Decimal('8.00'),
        )

        bread = self.products()['Chleb']

        # przychód 10 × 8 − zwrot 8 = 72 zł; surowce 12 upieczonych × 2,10 zł = 25,20 zł
        self.assertEqual((bread['sold'], bread['revenue'], bread['period_margin']), (9, '72.00', '46.80'))

    def test_missing_warehouse_prices_are_listed_and_excluded_from_average(self):
        self.order(self.bread, 10)
        self.order(self.challah, 10)

        data = self.api.get(URL, PERIOD).data
        challah = {p['name']: p for p in data['products']}['Chałka']

        self.assertEqual(challah['missing_prices'], ['Masło'])
        self.assertEqual(challah['unit_cost'], '1.05')
        self.assertEqual(data['average_margin_pct'], 73.8)
        self.assertEqual(data['missing_prices'], [{
            'ingredient_id': self.butter.pk, 'name': 'Masło', 'unit': 'kg', 'products': ['Chałka'],
        }])

    def test_products_without_recipe_have_no_cost(self):
        cookie = self.products()['Ciastko']

        self.assertFalse(cookie['has_recipe'])
        self.assertIsNone(cookie['unit_cost'])
        self.assertIsNone(cookie['period_margin'])

    def test_setting_a_price_removes_it_from_missing_and_is_logged(self):
        response = self.api.patch(
            f'/api/finance/ingredient-prices/{self.butter.pk}/', {'current_price': '32,5'}, format='json'
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(IngredientStock.objects.get(ingredient=self.butter).current_price, Decimal('32.50'))
        self.assertEqual(self.api.get(URL, PERIOD).data['missing_prices'], [])
        entry = AuditEntry.objects.get(action='ingredient.price_changed')
        self.assertEqual(entry.changes[0]['new'], '32.50 zł/kg')
        self.assertIsNone(entry.changes[0]['old'])

    def test_rejects_invalid_price(self):
        for price in ('0', '-3', 'tanio', None):
            with self.subTest(price=price):
                response = self.api.patch(
                    f'/api/finance/ingredient-prices/{self.butter.pk}/', {'current_price': price}, format='json'
                )
                self.assertEqual(response.status_code, 400)

    def test_editing_supplier_keeps_prices_of_kept_ingredients(self):
        self.api.put(
            f'/api/finance/suppliers/{self.mill.pk}/',
            {'name': 'Młyn', 'products': [{'product_id': self.flour.pk}]},
            format='json',
        )

        self.assertEqual(SupplierIngredient.objects.get(supplier=self.mill, ingredient=self.flour).last_price, Decimal('9.00'))

    def test_only_admin_has_access(self):
        self.api.force_authenticate(User.objects.create_user(username='baker_prof', password='x', role='baker', full_name='B'))

        self.assertEqual(self.api.get(URL).status_code, 403)