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
                'products': [{'product_id': ingredient_id, 'name': 'Nowy składnik (kg)'}],
            },
            format='json',
        )

        self.assertEqual(save_response.status_code, 200)
        self.assertEqual(save_response.data['products'][0]['product_id'], ingredient_id)
        self.assertEqual(
            list(self.supplier.ingredients_catalog.values_list('ingredient_id', flat=True)),
            [ingredient_id],
        )
        self.assertTrue(Ingredient.objects.filter(pk=ingredient_id).exists())
