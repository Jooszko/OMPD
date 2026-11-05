from decimal import Decimal

from django.test import SimpleTestCase
from rest_framework.test import APIClient

from audit.models import AuditEntry
from common.losses import LOSS_BUFFER_PCT
from production.models import Dough, ProductBakeSpec
from production.services.planning import generate_plan
from production.services.recipes import compose, rebuild_recipe, surplus_over_dough
from products.models import Ingredient, IngredientStock, Product, ProductAddition, Recipe

from .test_planning import PlanTestBase


def recipe_of(product):
    return {r.ingredient.name: r.amount for r in Recipe.objects.filter(product=product).select_related('ingredient')}


def additions_of(product):
    return {a.ingredient.name: a.amount for a in ProductAddition.objects.filter(product=product).select_related('ingredient')}


class RecipeArithmeticTests(SimpleTestCase):
    def test_recipe_is_dough_part_plus_additions(self):
        part = {1: Decimal('0.6') * Decimal('0.09'), 2: Decimal('0.0545') * Decimal('0.09')}

        self.assertEqual(
            compose(part, {2: Decimal('0.006'), 3: Decimal('0.050')}),
            {1: Decimal('0.054'), 2: Decimal('0.011'), 3: Decimal('0.050')},
        )

    def test_tiny_positive_amounts_do_not_round_to_zero(self):
        self.assertEqual(compose({1: Decimal('0.0004')}, {}), {1: Decimal('0.001')})

    def test_surplus_over_dough_becomes_additions(self):
        part = {1: Decimal('0.0540'), 2: Decimal('0.0049')}
        recipe = {1: Decimal('0.054'), 2: Decimal('0.011'), 3: Decimal('0.020')}

        self.assertEqual(surplus_over_dough(recipe, part), {2: Decimal('0.006'), 3: Decimal('0.020')})

    def test_rounding_noise_and_shortfalls_are_not_additions(self):
        part = {1: Decimal('0.0396'), 2: Decimal('0.0250')}
        recipe = {1: Decimal('0.0405'), 2: Decimal('0.0200')}

        self.assertEqual(surplus_over_dough(recipe, part), {})


class RecipeFromDoughTests(PlanTestBase):
    def setUp(self):
        super().setUp()
        self.api = APIClient()
        self.api.force_authenticate(self.admin)
        self.cheese = Ingredient.objects.create(name='Ser', unit='kg')
        IngredientStock.objects.create(ingredient=self.cheese)

    def assign(self, product, piece_weight='0.100', dough=None):
        return self.api.put(f'/api/production/bake-specs/{product.pk}/', {
            'dough_id': (dough or self.dough).pk, 'piece_weight_kg': piece_weight,
            'bake_temp_c': 220, 'bake_time_min': 15,
        }, format='json')

    def test_first_assignment_turns_manual_surplus_into_additions(self):
        roll = Product.objects.create(name='Bułka z serem', category='buns', base_price=Decimal('2'))
        Recipe.objects.create(product=roll, ingredient=self.flour, amount=Decimal('0.050'))
        Recipe.objects.create(product=roll, ingredient=self.cheese, amount=Decimal('0.020'))

        self.assertEqual(self.assign(roll).status_code, 200)

        self.assertEqual(additions_of(roll), {'Ser': Decimal('0.020')})
        # 0,1 kg kęsa: 0,060 kg mąki i 0,040 l wody z ciasta + ser jako dodatek.
        self.assertEqual(recipe_of(roll), {'Mąka 750': Decimal('0.060'), 'Woda': Decimal('0.040'), 'Ser': Decimal('0.020')})

    def test_new_piece_weight_rescales_dough_part_and_keeps_additions(self):
        self.assign(self.cake)
        ProductAddition.objects.create(product=self.cake, ingredient=self.cheese, amount=Decimal('0.030'))

        self.assertEqual(self.assign(self.cake, piece_weight='0.200').status_code, 200)

        self.assertEqual(recipe_of(self.cake), {'Mąka 750': Decimal('0.120'), 'Woda': Decimal('0.080'), 'Ser': Decimal('0.030')})
        entry = AuditEntry.objects.filter(action='recipe.recalculated', object_id=str(self.cake.pk)).latest('entry_id')
        self.assertIn('zmiana parametrów wyrobu', entry.description)

    def test_changing_composition_of_unused_dough_rebuilds_its_products(self):
        rebuild_recipe(self.bread_500)

        response = self.api.patch(f'/api/production/doughs/{self.dough.pk}/', {'ingredients': [
            {'ingredient_id': self.flour.pk, 'amount_per_kg': '0.6500'},
            {'ingredient_id': self.water.pk, 'amount_per_kg': '0.3500'},
        ]}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(recipe_of(self.bread_500), {'Mąka 750': Decimal('0.358'), 'Woda': Decimal('0.193')})
        self.assertEqual(recipe_of(self.bread_800), {'Mąka 750': Decimal('0.572'), 'Woda': Decimal('0.308')})

    def test_composition_of_dough_used_in_production_is_locked(self):
        self.order(self.bread_500, 100)
        generate_plan(self.delivery, self.admin)
        url = f'/api/production/doughs/{self.dough.pk}/'

        changed = self.api.patch(url, {'ingredients': [{'ingredient_id': self.flour.pk, 'amount_per_kg': '1.0000'}]}, format='json')
        renamed = self.api.patch(url, {'name': 'Ciasto wiejskie klasyczne', 'ingredients': [
            {'ingredient_id': self.flour.pk, 'amount_per_kg': '0.6000'},
            {'ingredient_id': self.water.pk, 'amount_per_kg': '0.4000'},
        ]}, format='json')

        self.assertEqual(changed.status_code, 400)
        self.assertIn('Utwórz nowe ciasto', changed.data['error'])
        self.assertEqual(renamed.status_code, 200)
        self.assertTrue(renamed.data['is_locked'])
        self.assertEqual(Dough.objects.get(pk=self.dough.pk).name, 'Ciasto wiejskie klasyczne')

    def test_loss_buffer_comes_from_the_shared_constant(self):
        created = self.api.post('/api/production/doughs/', {
            'name': 'Ciasto graham', 'loss_buffer_pct': '12.00', 'mixing_time_min': 10,
            'target_dough_temp_c': '27.0', 'proofing_time_min': 45,
            'ingredients': [{'ingredient_id': self.flour.pk, 'amount_per_kg': '1.0000'}],
        }, format='json')
        self.api.patch(f"/api/production/doughs/{created.data['dough_id']}/", {'loss_buffer_pct': '1.00'}, format='json')

        self.assertEqual(created.status_code, 201)
        self.assertEqual(Dough.objects.get(name='Ciasto graham').loss_buffer_pct, LOSS_BUFFER_PCT)

    def test_recipe_of_product_with_dough_accepts_only_additions(self):
        self.assign(self.cake)

        response = self.api.put(f'/api/products/recipes/{self.cake.pk}/', {
            'items': [{'ingredient_id': self.cheese.pk, 'amount': '0.025'}],
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['dough']['dough_name'], 'Ciasto wiejskie')
        self.assertEqual([i['ingredient_name'] for i in response.data['dough']['dough_items']], ['Mąka 750', 'Woda'])
        self.assertEqual(response.data['dough']['additions'][0]['amount'], '0.025')
        self.assertEqual(recipe_of(self.cake)['Ser'], Decimal('0.025'))
        self.assertEqual(AuditEntry.objects.filter(action='recipe.updated', object_id=str(self.cake.pk)).count(), 1)

    def test_empty_additions_leave_only_the_dough_part(self):
        self.assign(self.cake)
        ProductAddition.objects.create(product=self.cake, ingredient=self.cheese, amount=Decimal('0.030'))
        rebuild_recipe(self.cake)

        response = self.api.put(f'/api/products/recipes/{self.cake.pk}/', {'items': []}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(recipe_of(self.cake), {'Mąka 750': Decimal('0.060'), 'Woda': Decimal('0.040')})

    def test_invalid_additions_are_rejected(self):
        self.assign(self.cake)
        url = f'/api/products/recipes/{self.cake.pk}/'

        negative = self.api.put(url, {'items': [{'ingredient_id': self.cheese.pk, 'amount': '-1'}]}, format='json')
        twice = self.api.put(url, {'items': [{'ingredient_id': self.cheese.pk, 'amount': '0.01'}] * 2}, format='json')

        self.assertEqual(negative.status_code, 400)
        self.assertEqual(twice.status_code, 400)

    def test_unassigned_product_keeps_its_recipe_as_manual(self):
        self.assign(self.cake)
        ProductAddition.objects.create(product=self.cake, ingredient=self.cheese, amount=Decimal('0.030'))
        rebuild_recipe(self.cake)

        self.assertEqual(self.api.delete(f'/api/production/bake-specs/{self.cake.pk}/').status_code, 204)

        self.assertFalse(ProductBakeSpec.objects.filter(product=self.cake).exists())
        self.assertFalse(ProductAddition.objects.filter(product=self.cake).exists())
        self.assertEqual(recipe_of(self.cake)['Ser'], Decimal('0.030'))
        manual = self.api.put(f'/api/products/recipes/{self.cake.pk}/', {
            'items': [{'ingredient_id': self.flour.pk, 'amount': '0.100'}],
        }, format='json')
        self.assertEqual(manual.status_code, 200)
        self.assertIsNone(manual.data['dough'])
        self.assertEqual(recipe_of(self.cake), {'Mąka 750': Decimal('0.100')})
