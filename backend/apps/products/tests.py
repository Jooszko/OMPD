from django.test import TestCase
from rest_framework.test import APIClient

from audit.models import AuditEntry
from products.models import Ingredient, IngredientStock
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
