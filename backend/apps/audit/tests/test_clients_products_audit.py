from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from audit.models import AuditEntry
from clients.models import Client, Route
from products.models import Ingredient, Product, Recipe
from users.models import User


def change_rows(entry):
    return [(c['label'], c['old'], c['new']) for c in entry.changes]


class ClientAuditTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = User.objects.create_user(username='admin_c', password='x', role='admin', full_name='Anna Admin')
        self.api.force_authenticate(self.admin)
        self.route_a = Route.objects.create(route_name='Trasa A')
        self.route_b = Route.objects.create(route_name='Trasa B')
        self.client_obj = Client.objects.create(name='Sklep Pod Lipą', address='Lipowa 1', route=self.route_a)

    def test_creating_client_is_recorded(self):
        self.api.post(
            '/api/clients/', {'name': 'Kawiarnia Ranek', 'address': 'Polna 2', 'route': self.route_a.pk}, format='json'
        )

        entry = AuditEntry.objects.get(action='client.created')
        self.assertEqual((entry.actor, entry.object_label), (self.admin, 'Kawiarnia Ranek'))
        self.assertIn('Trasa A', entry.description)

    def test_editing_records_changed_fields_with_route_names(self):
        self.api.put(
            f'/api/clients/{self.client_obj.pk}/',
            {'phone': '500600700', 'route': self.route_b.pk, 'name': 'Sklep Pod Lipą'},
            format='json',
        )

        entry = AuditEntry.objects.get(action='client.updated')
        self.assertEqual(change_rows(entry), [('Telefon', '', '500600700'), ('Trasa', 'Trasa A', 'Trasa B')])

    def test_saving_without_changes_leaves_no_entry(self):
        self.api.put(f'/api/clients/{self.client_obj.pk}/', {'name': 'Sklep Pod Lipą'}, format='json')

        self.assertFalse(AuditEntry.objects.exists())


class ProductAuditTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.baker = User.objects.create_user(username='baker_p', password='x', role='baker', full_name='Piotr Piekarz')
        self.api.force_authenticate(self.baker)
        self.bread = Product.objects.create(name='Chleb żytni', category='bread', base_price=Decimal('4.50'))
        self.flour = Ingredient.objects.create(name='Mąka', unit='kg')
        self.water = Ingredient.objects.create(name='Woda', unit='l')
        self.salt = Ingredient.objects.create(name='Sól', unit='kg')

    def test_price_change_has_its_own_action(self):
        self.api.patch(f'/api/products/{self.bread.pk}/', {'base_price': '4.80'}, format='json')

        entry = AuditEntry.objects.get(category='products')
        self.assertEqual(entry.action, 'product.price_changed')
        self.assertEqual(entry.actor, self.baker)
        self.assertEqual(change_rows(entry), [('Cena', '4.50', '4.80')])

    def test_renaming_with_price_is_a_general_update(self):
        self.api.patch(f'/api/products/{self.bread.pk}/', {'name': 'Chleb razowy', 'base_price': '5.00'}, format='json')

        entry = AuditEntry.objects.get(category='products')
        self.assertEqual(entry.action, 'product.updated')
        self.assertEqual([c['label'] for c in entry.changes], ['Nazwa', 'Cena'])

    def test_new_recipe_lists_its_ingredients(self):
        self.api.post(
            '/api/products/recipes/',
            {'name': 'Bagietka', 'category': 'bread', 'items': [{'ingredient_id': self.flour.pk, 'amount': '0.3'}]},
            format='json',
        )

        entry = AuditEntry.objects.get(action='recipe.created')
        self.assertEqual(change_rows(entry), [('Mąka', None, '0.300 kg')])

    def test_recipe_update_shows_added_removed_and_changed_ingredients(self):
        Recipe.objects.create(product=self.bread, ingredient=self.flour, amount=Decimal('0.500'))
        Recipe.objects.create(product=self.bread, ingredient=self.water, amount=Decimal('0.300'))

        self.api.put(
            f'/api/products/recipes/{self.bread.pk}/',
            {'items': [
                {'ingredient_id': self.flour.pk, 'amount': '0.6'},
                {'ingredient_id': self.salt.pk, 'amount': '0.01'},
            ]},
            format='json',
        )

        entry = AuditEntry.objects.get(action='recipe.updated')
        self.assertEqual(change_rows(entry), [
            ('Mąka', '0.500 kg', '0.600 kg'),
            ('Sól', None, '0.010 kg'),
            ('Woda', '0.300 l', None),
        ])

    def test_deleting_recipe_records_what_was_removed(self):
        Recipe.objects.create(product=self.bread, ingredient=self.flour, amount=Decimal('0.500'))

        self.api.delete(f'/api/products/recipes/{self.bread.pk}/')

        entry = AuditEntry.objects.get(action='recipe.deleted')
        self.assertEqual(change_rows(entry), [('Mąka', '0.500 kg', None)])