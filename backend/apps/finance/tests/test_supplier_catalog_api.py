from django.test import TestCase
from rest_framework.test import APIClient

from finance.models import Supplier
from products.models import Ingredient
from users.models import User


class SupplierCatalogApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = User.objects.create_user(
            username='admin_supplier_catalog', password='x', role='admin', full_name='Admin'
        )
        self.api.force_authenticate(self.admin)
        self.supplier = Supplier.objects.create(name='Dostawca')

    def test_newly_created_ingredient_can_be_assigned_to_supplier(self):
        ingredient_response = self.api.post(
            '/api/products/ingredients/', {'name': 'Nowy składnik', 'unit': 'kg'}, format='json'
        )
        self.assertEqual(ingredient_response.status_code, 201)
        ingredient_id = ingredient_response.data['ingredient_id']

        save_response = self.api.put(
            f'/api/finance/suppliers/{self.supplier.pk}/',
            {
                'name': self.supplier.name,
                'products': [{
                    'product_id': ingredient_id,
                    'name': 'Nowy składnik (kg)',
                    'last_price': '12.50',
                }],
            },
            format='json',
        )

        self.assertEqual(save_response.status_code, 200)
        self.assertEqual(save_response.data['products'][0]['product_id'], ingredient_id)
        self.assertEqual(save_response.data['products'][0]['unit'], 'kg')
        self.assertEqual(save_response.data['products'][0]['last_price'], '12.50')
        self.assertTrue(save_response.data['products'][0]['is_assigned'])
        self.assertEqual(
            list(self.supplier.ingredients_catalog.values_list('ingredient_id', flat=True)),
            [ingredient_id],
        )
        self.assertEqual(
            str(self.supplier.ingredients_catalog.get().last_price),
            '12.50',
        )
        self.assertTrue(Ingredient.objects.filter(pk=ingredient_id).exists())

    def test_removing_ingredient_from_supplier_keeps_its_price(self):
        ingredient = Ingredient.objects.create(name='Mąka', unit='kg')
        self.api.put(
            f'/api/finance/suppliers/{self.supplier.pk}/',
            {
                'name': self.supplier.name,
                'products': [{
                    'product_id': ingredient.pk,
                    'last_price': '8.75',
                    'is_assigned': True,
                }],
            },
            format='json',
        )

        response = self.api.put(
            f'/api/finance/suppliers/{self.supplier.pk}/',
            {'name': self.supplier.name, 'products': []},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        catalog_item = self.supplier.ingredients_catalog.get(ingredient=ingredient)
        self.assertEqual(str(catalog_item.last_price), '8.75')
        self.assertFalse(catalog_item.is_assigned)
        self.assertEqual(len(response.data['products']), 1)
        self.assertFalse(response.data['products'][0]['is_assigned'])
        self.assertEqual(response.data['products'][0]['last_price'], '8.75')

        reassign_response = self.api.put(
            f'/api/finance/suppliers/{self.supplier.pk}/',
            {
                'name': self.supplier.name,
                'products': [{
                    'product_id': ingredient.pk,
                    'last_price': '8.75',
                    'is_assigned': True,
                }],
            },
            format='json',
        )

        self.assertEqual(reassign_response.status_code, 200)
        self.assertTrue(self.supplier.ingredients_catalog.get(ingredient=ingredient).is_assigned)
        self.assertEqual(
            str(self.supplier.ingredients_catalog.get(ingredient=ingredient).last_price),
            '8.75',
        )

    def test_supplier_catalog_rejects_invalid_price(self):
        ingredient = Ingredient.objects.create(name='Mąka', unit='kg')

        response = self.api.put(
            f'/api/finance/suppliers/{self.supplier.pk}/',
            {
                'name': self.supplier.name,
                'products': [{'product_id': ingredient.pk, 'last_price': '0'}],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(self.supplier.ingredients_catalog.exists())
