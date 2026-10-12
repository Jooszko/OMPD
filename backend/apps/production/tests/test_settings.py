from decimal import Decimal

from rest_framework.test import APIClient

from production.models import Dough, Mixer, ProductBakeSpec
from production.services.planning import build_plan_preview, generate_plan
from users.models import User

from .test_planning import PlanTestBase


class ProductionSettingsApiTests(PlanTestBase):
    def setUp(self):
        super().setUp()
        self.api = APIClient()

    def as_user(self, user):
        self.api.force_authenticate(user)
        return self.api

    def dough_payload(self, **overrides):
        return {
            'name': 'Ciasto żytnie',
            'mixer_id': self.mixer.pk,
            'loss_buffer_pct': '3.00',
            'mixing_time_min': 8,
            'target_dough_temp_c': '28.0',
            'proofing_time_min': 60,
            'mixing_instructions': 'Wolne obroty.',
            'ingredients': [
                {'ingredient_id': self.flour.pk, 'amount_per_kg': '0.6000'},
                {'ingredient_id': self.water.pk, 'amount_per_kg': '0.4000'},
            ],
            **overrides,
        }

    def test_settings_lists_products_with_and_without_bake_spec(self):
        response = self.as_user(self.baker).get('/api/production/settings/')

        self.assertEqual(response.status_code, 200)
        rows = {row['product_name']: row for row in response.data['products']}
        self.assertEqual(rows['Chleb wiejski 500g']['spec']['dough_name'], 'Ciasto wiejskie')
        self.assertIsNone(rows['Sernik']['spec'])
        self.assertEqual(response.data['doughs'][0]['products_count'], 2)
        self.assertEqual(len(response.data['ingredients']), 2)

    def test_driver_cannot_read_settings(self):
        driver = User.objects.create_user(username='kierowca', password='x', role='driver')

        self.assertEqual(self.as_user(driver).get('/api/production/settings/').status_code, 403)

    def test_baker_cannot_change_settings(self):
        api = self.as_user(self.baker)

        self.assertEqual(api.post('/api/production/mixers/', {'name': 'X', 'max_capacity_kg': '10'}).status_code, 403)
        self.assertEqual(api.post('/api/production/doughs/', self.dough_payload(), format='json').status_code, 403)
        self.assertEqual(api.delete(f'/api/production/bake-specs/{self.bread_500.pk}/').status_code, 403)

    def test_admin_creates_and_deactivates_mixer(self):
        api = self.as_user(self.admin)

        created = api.post('/api/production/mixers/', {'name': 'Mała 40', 'min_capacity_kg': '5', 'max_capacity_kg': '40'})
        self.assertEqual(created.status_code, 201)
        updated = api.patch(f"/api/production/mixers/{created.data['mixer_id']}/", {'is_active': False})

        self.assertEqual(updated.status_code, 200)
        self.assertFalse(Mixer.objects.get(name='Mała 40').is_active)

    def test_mixer_minimum_above_maximum_is_rejected(self):
        response = self.as_user(self.admin).post(
            '/api/production/mixers/', {'name': 'Zła', 'min_capacity_kg': '50', 'max_capacity_kg': '40'}
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('Minimalny wsad', response.data['error'])

    def test_admin_creates_dough_with_recipe(self):
        response = self.as_user(self.admin).post('/api/production/doughs/', self.dough_payload(), format='json')

        self.assertEqual(response.status_code, 201)
        dough = Dough.objects.get(name='Ciasto żytnie')
        self.assertEqual(dough.mixer, self.mixer)
        self.assertEqual(
            {i['name']: i['amount_per_kg'] for i in response.data['ingredients']},
            {'Mąka 750': '0.6000', 'Woda': '0.4000'},
        )

    def test_dough_recipe_is_replaced_on_update(self):
        response = self.as_user(self.admin).patch(
            f'/api/production/doughs/{self.dough.pk}/',
            {'ingredients': [{'ingredient_id': self.flour.pk, 'amount_per_kg': '1.0000'}]},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(list(self.dough.dough_ingredients.values_list('amount_per_kg', flat=True)), [Decimal('1.0000')])

    def test_dough_without_ingredients_or_with_duplicates_is_rejected(self):
        api = self.as_user(self.admin)
        duplicate = [{'ingredient_id': self.flour.pk, 'amount_per_kg': '0.5'}] * 2

        empty = api.post('/api/production/doughs/', self.dough_payload(ingredients=[]), format='json')
        twice = api.post('/api/production/doughs/', self.dough_payload(ingredients=duplicate), format='json')

        self.assertEqual(empty.status_code, 400)
        self.assertEqual(twice.status_code, 400)
        self.assertIn('tylko raz', twice.data['error'])

    def test_dough_used_by_products_cannot_be_deleted(self):
        response = self.as_user(self.admin).delete(f'/api/production/doughs/{self.dough.pk}/')

        self.assertEqual(response.status_code, 409)
        self.assertTrue(Dough.objects.filter(pk=self.dough.pk).exists())

    def test_unused_dough_can_be_deleted(self):
        unused = Dough.objects.create(name='Nieużywane')

        response = self.as_user(self.admin).delete(f'/api/production/doughs/{unused.pk}/')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Dough.objects.filter(pk=unused.pk).exists())

    def test_assigning_bake_spec_brings_product_into_planning(self):
        self.order(self.cake, 20)
        self.assertEqual(build_plan_preview(self.delivery)['unassigned_products'][0]['product_name'], 'Sernik')

        response = self.as_user(self.admin).put(
            f'/api/production/bake-specs/{self.cake.pk}/',
            {'dough_id': self.dough.pk, 'piece_weight_kg': '0.250', 'bake_temp_c': 180, 'bake_time_min': 40},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['spec']['dough_name'], 'Ciasto wiejskie')
        preview = build_plan_preview(self.delivery)
        self.assertEqual(preview['unassigned_products'], [])
        self.assertIn('Sernik', [p['product_name'] for p in preview['doughs'][0]['products']])

    def test_bake_spec_update_and_removal(self):
        api = self.as_user(self.admin)
        url = f'/api/production/bake-specs/{self.bread_500.pk}/'

        updated = api.put(url, {'dough_id': self.dough.pk, 'piece_weight_kg': '0.600', 'bake_temp_c': 220,
                                'bake_time_min': 45}, format='json')
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(ProductBakeSpec.objects.get(product=self.bread_500).piece_weight_kg, Decimal('0.600'))

        self.assertEqual(api.delete(url).status_code, 204)
        self.assertFalse(ProductBakeSpec.objects.filter(product=self.bread_500).exists())

    def test_zero_piece_weight_is_rejected(self):
        response = self.as_user(self.admin).put(
            f'/api/production/bake-specs/{self.cake.pk}/',
            {'dough_id': self.dough.pk, 'piece_weight_kg': '0', 'bake_temp_c': 180, 'bake_time_min': 40},
            format='json',
        )

        self.assertEqual(response.status_code, 400)

    def test_changing_settings_does_not_alter_saved_plan(self):
        self.order(self.bread_500, 50)
        plan, _ = generate_plan(self.delivery, self.admin)
        before = list(plan.batches.get().ingredients.values_list('amount', flat=True))

        self.as_user(self.admin).patch(
            f'/api/production/doughs/{self.dough.pk}/',
            {'ingredients': [{'ingredient_id': self.flour.pk, 'amount_per_kg': '1.0000'}]},
            format='json',
        )
        self.as_user(self.admin).put(
            f'/api/production/bake-specs/{self.bread_500.pk}/',
            {'dough_id': self.dough.pk, 'piece_weight_kg': '0.900', 'bake_temp_c': 230, 'bake_time_min': 40},
            format='json',
        )

        batch = plan.batches.get()
        self.assertEqual(list(batch.ingredients.values_list('amount', flat=True)), before)
        self.assertEqual(batch.outputs.get().piece_weight_kg, Decimal('0.550'))
