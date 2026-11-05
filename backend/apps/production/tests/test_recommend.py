from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from dashboard.seed.production import BAKE_SPEC_DATA, create_production_setup
from dashboard.seed.products import create_ingredients, create_products
from production.models import Dough, DoughIngredient, Mixer, ProductBakeSpec
from production.services.recommend import GOOD_MATCH, dough_like_ingredients, match_dough, recommend_doughs
from products.models import Ingredient, Product
from users.models import User


KG = {1: 'kg', 2: 'kg', 3: 'kg', 4: 'kg', 5: 'szt'}


class MatchDoughTests(TestCase):
    def test_ingredient_used_in_no_dough_is_an_addition(self):
        dough = {1: Decimal('0.6'), 2: Decimal('0.4')}
        roll_with_cheese = {1: Decimal('0.060'), 2: Decimal('0.040'), 3: Decimal('0.020')}

        match = match_dough(roll_with_cheese, dough, KG, dough_like={1, 2})

        self.assertEqual(match['score'], Decimal('1'))
        self.assertAlmostEqual(match['weight'], Decimal('0.1'), places=4)
        self.assertEqual(match['additions'], {3: Decimal('0.020')})
        self.assertEqual(match['foreign'], [])

    def test_ingredient_typical_for_doughs_is_not_an_addition(self):
        # Mąka i masło to za mało, żeby wyjaśnić chałkę: jaja i mleko też wchodzą do ciast.
        dough = {1: Decimal('0.8'), 2: Decimal('0.2')}
        challah = {1: Decimal('0.225'), 2: Decimal('0.027'), 4: Decimal('0.090'), 5: Decimal('0.700')}

        match = match_dough(challah, dough, KG, dough_like={1, 2, 4, 5})

        self.assertEqual(sorted(match['foreign']), [4, 5])
        self.assertEqual(match['additions'], {})
        self.assertLess(match['score'], Decimal('0.5'))

    def test_missing_dough_ingredients_lower_the_match(self):
        dough = {1: Decimal('0.5'), 2: Decimal('0.4'), 3: Decimal('0.1')}

        match = match_dough({1: Decimal('0.050'), 2: Decimal('0.040')}, dough, KG, dough_like={1, 2, 3})

        self.assertEqual(match['missing'], [3])
        # Pokrycie 2 z 3 surowców liczy się w kwadracie.
        self.assertAlmostEqual(match['score'], (Decimal('2') / 3) ** 2, places=3)

    def test_different_proportions_lower_the_match(self):
        dough = {1: Decimal('0.6'), 2: Decimal('0.3'), 3: Decimal('0.1')}
        # Trzy razy więcej surowca 3 niż w cieście.
        product = {1: Decimal('0.060'), 2: Decimal('0.030'), 3: Decimal('0.030')}

        match = match_dough(product, dough, KG, dough_like={1, 2, 3})

        self.assertIn(3, match['mismatched'])
        self.assertLess(match['score'], GOOD_MATCH)

    def test_small_differences_are_not_reported_as_mismatch(self):
        dough = {1: Decimal('0.6'), 2: Decimal('0.4')}
        # Mąka 2 % ponad ciasto — mieści się w zwykłych wahaniach receptury.
        product = {1: Decimal('0.612'), 2: Decimal('0.400')}

        match = match_dough(product, dough, KG, dough_like={1, 2})

        self.assertEqual(match['mismatched'], [])
        self.assertGreater(match['score'], Decimal('0.9'))

    def test_wrong_main_ingredient_is_not_a_good_match(self):
        # Osiem surowców: sześć drobnych się zgadza, ale mąki jest o 25 % więcej względem wody.
        dough = {i: Decimal('0.0083') for i in range(3, 9)}
        dough.update({1: Decimal('0.60'), 2: Decimal('0.35')})
        product = {i: (amount * Decimal('0.1')).quantize(Decimal('0.001')) for i, amount in dough.items()}
        product[1] = Decimal('0.075')
        units = {i: 'kg' for i in dough}

        match = match_dough(product, dough, units, dough_like=set(dough))

        self.assertTrue(match['mismatched'])
        self.assertLess(match['score'], GOOD_MATCH)

    def test_rounding_of_tiny_amounts_is_not_a_mismatch(self):
        dough = {1: Decimal('0.6'), 2: Decimal('0.0108')}
        # 0,065 kg x 0,0108 = 0,0007 — receptura zapisuje 0,001.
        roll = {1: Decimal('0.039'), 2: Decimal('0.001')}

        match = match_dough(roll, dough, KG, dough_like={1, 2})

        self.assertEqual(match['mismatched'], [])
        self.assertEqual(match['score'], Decimal('1'))


class SeedRecommendationTests(TestCase):
    """Na danych z seeda każdy wyrób powinien wskazać ciasto, z którego naprawdę powstaje."""

    @classmethod
    def setUpTestData(cls):
        ingredients = create_ingredients()
        products = create_products(ingredients)
        create_production_setup(ingredients, products)

    def test_every_seeded_product_points_to_its_own_dough(self):
        for name, dough_name, weight, *_rest, extras in BAKE_SPEC_DATA:
            with self.subTest(product=name):
                result = recommend_doughs(Product.objects.get(name=name))
                best = result['suggestions'][0]

                self.assertEqual(best['dough_name'], dough_name)
                self.assertGreaterEqual(best['score'], GOOD_MATCH)
                self.assertAlmostEqual(best['piece_weight_kg'], weight, delta=Decimal('0.003'))
                self.assertEqual({a['name'] for a in best['additions']}, {ingredient for ingredient, _ in extras})
                self.assertEqual(best['foreign'], [])
                self.assertEqual(best['missing'], [])

    def test_only_the_own_dough_is_a_good_match(self):
        for name, dough_name, *_ in BAKE_SPEC_DATA:
            with self.subTest(product=name):
                for suggestion in recommend_doughs(Product.objects.get(name=name))['suggestions'][1:]:
                    self.assertLess(suggestion['score'], GOOD_MATCH, suggestion['dough_name'])

    def test_dough_of_flour_and_butter_does_not_fit_challah(self):
        ingredients = {i.name: i for i in Ingredient.objects.all()}
        dough = Dough.objects.create(name='Ciasto testowe', mixer=Mixer.objects.first())
        DoughIngredient.objects.create(dough=dough, ingredient=ingredients['Mąka pszenna typ 550'], amount_per_kg=Decimal('0.8'))
        DoughIngredient.objects.create(dough=dough, ingredient=ingredients['Masło'], amount_per_kg=Decimal('0.2'))

        result = recommend_doughs(Product.objects.get(name='Chałka z rodzynkami'))

        self.assertEqual(result['suggestions'][0]['dough_name'], 'Ciasto chałkowe')
        for suggestion in result['suggestions']:
            if suggestion['dough_name'] == 'Ciasto testowe':
                self.assertLess(suggestion['score'], Decimal('0.5'))
                self.assertIn('Jaja', suggestion['foreign'])


class DoughLikeIngredientsTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        ingredients = create_ingredients()
        products = create_products(ingredients)
        create_production_setup(ingredients, products)
        cls.ingredients = ingredients

    def test_one_dough_with_poppy_seed_does_not_spoil_poppy_seed_rolls(self):
        poppy_dough = Dough.objects.create(name='Ciasto makowe', mixer=Mixer.objects.first())
        for name, amount in [('Mąka pszenna typ 550', '0.55'), ('Woda', '0.35'), ('Mak', '0.10')]:
            DoughIngredient.objects.create(dough=poppy_dough, ingredient=self.ingredients[name], amount_per_kg=Decimal(amount))
        # Mak: jedno ciasto, jeden dodatek (drożdżówka z makiem) — remis, więc przeważa rola dodatku.

        best = recommend_doughs(Product.objects.get(name='Drożdżówka z makiem'))['suggestions'][0]

        self.assertEqual(best['dough_name'], 'Ciasto drożdżowe słodkie')
        self.assertGreaterEqual(best['score'], GOOD_MATCH)
        self.assertEqual([a['name'] for a in best['additions']], ['Mak'])

    def test_ingredient_mostly_used_in_doughs_is_dough_like(self):
        dough_like = dough_like_ingredients(list(Dough.objects.prefetch_related('dough_ingredients')))

        self.assertIn(self.ingredients['Jaja'].pk, dough_like)
        self.assertNotIn(self.ingredients['Twaróg'].pk, dough_like)


class DoughSuggestionsApiTests(TestCase):
    def setUp(self):
        ingredients = create_ingredients()
        products = create_products(ingredients)
        create_production_setup(ingredients, products)
        self.api = APIClient()
        self.baker = User.objects.create_user(username='piekarz', password='x', role='baker')
        self.roll = Product.objects.get(name='Bułka z serem')

    def test_baker_gets_ranked_suggestions(self):
        self.api.force_authenticate(self.baker)

        response = self.api.get(f'/api/production/products/{self.roll.pk}/dough-suggestions/')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['has_recipe'])
        self.assertEqual(response.data['suggestions'][0]['dough_name'], 'Ciasto pszenne')
        self.assertEqual(response.data['suggestions'][0]['additions'][0]['name'], 'Ser żółty')
        self.assertLessEqual(len(response.data['suggestions']), 3)
        self.assertTrue(ProductBakeSpec.objects.filter(product=self.roll).exists())

    def test_product_without_recipe_has_no_suggestions(self):
        self.api.force_authenticate(self.baker)
        empty = Product.objects.create(name='Nowy wyrób', category='bread', base_price=Decimal('1'))

        response = self.api.get(f'/api/production/products/{empty.pk}/dough-suggestions/')

        self.assertFalse(response.data['has_recipe'])
        self.assertEqual(response.data['suggestions'], [])

    def test_driver_is_forbidden(self):
        self.api.force_authenticate(User.objects.create_user(username='kierowca', password='x', role='driver'))

        response = self.api.get(f'/api/production/products/{self.roll.pk}/dough-suggestions/')

        self.assertEqual(response.status_code, 403)
