from datetime import date
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from audit.models import AuditEntry
from clients.models import Client, Route
from orders.models import DailyOrder
from products.models import Ingredient, IngredientStock, Product, Recipe
from users.models import User


class IngredientCreateApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = User.objects.create_user(
            username='admin_ingredient', password='x', role='admin', full_name='Admin'
        )
        self.baker = User.objects.create_user(
            username='baker_ingredient', password='x', role='baker', full_name='Baker'
        )

    def test_admin_can_create_ingredient_and_initial_stock(self):
        self.api.force_authenticate(self.admin)

        response = self.api.post(
            '/api/products/ingredients/', {'name': 'Zakwas', 'unit': 'kg'}, format='json'
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['name'], 'Zakwas')
        self.assertEqual(response.data['unit'], 'kg')
        ingredient = Ingredient.objects.get(pk=response.data['ingredient_id'])
        self.assertTrue(IngredientStock.objects.filter(ingredient=ingredient).exists())
        self.assertEqual(AuditEntry.objects.get(action='ingredient.created').object_id, str(ingredient.pk))

    def test_baker_cannot_create_ingredient(self):
        self.api.force_authenticate(self.baker)

        response = self.api.post(
            '/api/products/ingredients/', {'name': 'Zakwas', 'unit': 'kg'}, format='json'
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(Ingredient.objects.exists())

    def test_name_and_unit_are_required(self):
        self.api.force_authenticate(self.admin)

        response = self.api.post('/api/products/ingredients/', {'name': 'Zakwas'}, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('unit', response.data)
        self.assertFalse(Ingredient.objects.exists())


class ProductDeleteApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = User.objects.create_user(
            username='admin_product_delete', password='x', role='admin', full_name='Admin'
        )
        self.baker = User.objects.create_user(
            username='baker_product_delete', password='x', role='baker', full_name='Baker'
        )
        self.product = Product.objects.create(name='Chleb', category='bread', base_price=Decimal('5.00'))
        ingredient = Ingredient.objects.create(name='Mąka', unit='kg')
        Recipe.objects.create(product=self.product, ingredient=ingredient, amount=Decimal('1.000'))

    def test_admin_can_delete_product_and_recipe_from_product_endpoint(self):
        self.api.force_authenticate(self.admin)

        response = self.api.delete(f'/api/products/{self.product.pk}/')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Product.objects.filter(pk=self.product.pk).exists())
        self.assertFalse(Recipe.objects.filter(product_id=self.product.pk).exists())
        self.assertEqual(AuditEntry.objects.get(action='product.deleted').object_id, str(self.product.pk))

    def test_product_used_by_orders_cannot_be_deleted(self):
        route = Route.objects.create(route_name='Trasa testowa')
        client = Client.objects.create(name='Sklep', address='Adres', route=route)
        DailyOrder.objects.create(
            client=client,
            product=self.product,
            order_date=date.today(),
            quantity=1,
            price_at_sale=Decimal('5.00'),
        )
        self.api.force_authenticate(self.admin)

        response = self.api.delete(f'/api/products/{self.product.pk}/')

        self.assertEqual(response.status_code, 409)
        self.assertTrue(Product.objects.filter(pk=self.product.pk).exists())
        self.assertTrue(Recipe.objects.filter(product_id=self.product.pk).exists())
        self.assertFalse(AuditEntry.objects.filter(action='product.deleted').exists())

    def test_baker_cannot_delete_product(self):
        self.api.force_authenticate(self.baker)

        response = self.api.delete(f'/api/products/{self.product.pk}/')

        self.assertEqual(response.status_code, 403)
        self.assertTrue(Product.objects.filter(pk=self.product.pk).exists())
