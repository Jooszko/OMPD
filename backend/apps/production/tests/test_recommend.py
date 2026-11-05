from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from dashboard.seed.production import BAKE_SPEC_DATA, create_production_setup
from dashboard.seed.products import create_ingredients, create_products
from production.models import ProductBakeSpec
from production.services.recommend import GOOD_MATCH, match_dough, recommend_doughs
from products.models import Product
from users.models import User


class MatchDoughTests(TestCase):
    def test_additions_do_not_lower_the_match(self):
        dough = {1: Decimal('0.6'), 2: Decimal('0.4')}
        roll_with_cheese = {1: Decimal('0.06'), 2: Decimal('0.04'), 3: Decimal('0.02')}

        score, weight, surplus, missing = match_dough(roll_with_cheese, dough)

        self.assertEqual(score, Decimal('1'))
        self.assertAlmostEqual(weight, Decimal('0.1'), places=4)
        self.assertEqual(set(surplus), {3})
        self.assertEqual(missing, [])

    def test_missing_dough_ingredients_lower_the_match(self):
        dough = {1: Decimal('0.5'), 2: Decimal('0.4'), 3: Decimal('0.1')}

        score, _, _, missing = match_dough({1: Decimal('0.05'), 2: Decimal('0.04')}, dough)

        self.assertEqual(missing, [3])
        self.assertAlmostEqual(score, Decimal('0.9'), places=3)


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

    def test_doughs_from_another_family_never_look_like_a_good_match(self):
        # Ciasta słodkie mają zbliżony skład (różnią się głównie jajami i drożdżami), więc mogą być blisko
        # siebie w rankingu. Ciasto chlebowe dla drożdżówki (i odwrotnie) nie może jednak przejść progu.
        sweet = {'Ciasto maślane', 'Ciasto chałkowe', 'Ciasto drożdżowe słodkie', 'Ciasto pączkowe'}
        for name, dough_name, *_ in BAKE_SPEC_DATA:
            with self.subTest(product=name):
                for suggestion in recommend_doughs(Product.objects.get(name=name))['suggestions']:
                    if (suggestion['dough_name'] in sweet) != (dough_name in sweet):
                        self.assertLess(suggestion['score'], GOOD_MATCH, suggestion['dough_name'])


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
