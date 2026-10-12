from datetime import date, timedelta
from decimal import Decimal

from django.test import SimpleTestCase, TestCase, override_settings

from clients.models import Client, Route
from orders.models import DailyOrder
from production.models import (
    Dough,
    DoughIngredient,
    Mixer,
    ProductBakeSpec,
    ProductionBatch,
    ProductionPlan,
)
from production.services.planning import (
    PieceDemand,
    PlanLockedError,
    PlanningError,
    build_plan_preview,
    generate_plan,
    production_date_for,
    split_into_batches,
)
from products.models import Ingredient, IngredientStock, Product
from users.models import User


class SplitIntoBatchesTests(SimpleTestCase):
    def test_fits_in_one_batch(self):
        splits = split_into_batches([PieceDemand(1, 100, Decimal('0.500'))], Decimal('1'), Decimal('80'))

        self.assertEqual(len(splits), 1)
        self.assertEqual(splits[0].pieces, {1: 100})
        self.assertEqual(splits[0].dough_mass_kg, Decimal('50.000'))

    def test_splits_into_equal_batches_instead_of_full_plus_remainder(self):
        # 130 kg przy mieszałce 100 kg: dwie dzieże po 65 kg, a nie 100 + 30.
        splits = split_into_batches([PieceDemand(1, 260, Decimal('0.500'))], Decimal('1'), Decimal('100'))

        self.assertEqual([s.dough_mass_kg for s in splits], [Decimal('65.000'), Decimal('65.000')])
        self.assertEqual(sum(s.pieces[1] for s in splits), 260)

    def test_loss_buffer_counts_towards_capacity(self):
        # 100 kg kęsów + 3% bufora nie zmieści się w jednej mieszałce 100 kg.
        splits = split_into_batches([PieceDemand(1, 200, Decimal('0.500'))], Decimal('1.03'), Decimal('100'))

        self.assertEqual(len(splits), 2)
        self.assertEqual(sum(s.dough_mass_kg for s in splits), Decimal('103.000'))

    def test_mixed_products_are_spread_evenly(self):
        demands = [
            PieceDemand(1, 101, Decimal('0.800')),
            PieceDemand(2, 57, Decimal('0.500')),
            PieceDemand(3, 333, Decimal('0.080')),
        ]
        splits = split_into_batches(demands, Decimal('1.02'), Decimal('60'))

        masses = [s.dough_mass_kg for s in splits]
        self.assertTrue(all(m <= Decimal('60') for m in masses))
        self.assertLessEqual(max(masses) - min(masses), Decimal('0.816'))  # najwyżej jeden najcięższy kęs
        for demand in demands:
            self.assertEqual(sum(s.pieces.get(demand.key, 0) for s in splits), demand.quantity)

    def test_adds_batch_when_rounding_pieces_overflows_capacity(self):
        # 3 kęsy po 40 kg przy mieszałce 60 kg: dwie dzieże dałyby 80 + 40, więc potrzebne są trzy.
        splits = split_into_batches([PieceDemand(1, 3, Decimal('40'))], Decimal('1'), Decimal('60'))

        self.assertEqual([s.pieces[1] for s in splits], [1, 1, 1])

    def test_empty_demand(self):
        self.assertEqual(split_into_batches([], Decimal('1'), Decimal('100')), [])


@override_settings(PRODUCTION_SHIFT_LAG_DAYS=1)
class PlanTestBase(TestCase):
    def setUp(self):
        self.delivery = date(2026, 10, 13)
        route = Route.objects.create(route_name='Trasa P1')
        self.shop = Client.objects.create(name='Sklep A', address='Adres A', route=route)
        self.shop_b = Client.objects.create(name='Sklep B', address='Adres B', route=route)
        self.admin = User.objects.create_user(username='kierownik', password='x', role='admin', full_name='Anna Kierownik')
        self.baker = User.objects.create_user(username='piekarz', password='x', role='baker', full_name='Jan Piekarz')

        self.flour = Ingredient.objects.create(name='Mąka 750', unit='kg')
        self.water = Ingredient.objects.create(name='Woda', unit='l')
        IngredientStock.objects.create(ingredient=self.flour, current_stock=Decimal('50'))
        IngredientStock.objects.create(ingredient=self.water, current_stock=Decimal('500'))

        self.mixer = Mixer.objects.create(name='Spiralna 120', min_capacity_kg=Decimal('20'), max_capacity_kg=Decimal('100'))
        self.dough = Dough.objects.create(name='Ciasto wiejskie', loss_buffer_pct=Decimal('2.00'))
        DoughIngredient.objects.create(dough=self.dough, ingredient=self.flour, amount_per_kg=Decimal('0.6'))
        DoughIngredient.objects.create(dough=self.dough, ingredient=self.water, amount_per_kg=Decimal('0.4'))

        self.bread_500 = self.make_product('Chleb wiejski 500g', self.dough, '0.550')
        self.bread_800 = self.make_product('Chleb wiejski 800g', self.dough, '0.880')
        self.cake = Product.objects.create(name='Sernik', category='pastry', base_price=Decimal('6'))

    def make_product(self, name, dough, piece_weight):
        product = Product.objects.create(name=name, category='bread', base_price=Decimal('5'))
        ProductBakeSpec.objects.create(
            product=product, dough=dough, piece_weight_kg=Decimal(piece_weight), bake_temp_c=230, bake_time_min=40
        )
        return product

    def order(self, product, quantity, client=None, status='planned', day=None):
        return DailyOrder.objects.create(
            client=client or self.shop, product=product, order_date=day or self.delivery,
            quantity=quantity, price_at_sale=Decimal('5'), status=status,
        )


class BuildPlanPreviewTests(PlanTestBase):
    def test_production_runs_one_day_ahead(self):
        self.assertEqual(production_date_for(self.delivery), date(2026, 10, 12))

    def test_products_sharing_a_dough_are_aggregated(self):
        self.order(self.bread_500, 60)
        self.order(self.bread_500, 40, client=self.shop_b)
        self.order(self.bread_800, 50)
        self.order(self.bread_800, 999, status='cancelled')
        self.order(self.bread_800, 999, day=self.delivery + timedelta(days=1))

        preview = build_plan_preview(self.delivery)

        self.assertEqual(len(preview['doughs']), 1)
        dough = preview['doughs'][0]
        self.assertEqual([p['ordered_qty'] for p in dough['products']], [100, 50])
        # 100 * 0.55 + 50 * 0.88 = 99 kg kęsów, +2% bufora = 100.98 kg → 2 dzieże.
        self.assertEqual(dough['raw_mass_kg'], Decimal('99.000'))
        self.assertEqual(dough['total_mass_kg'], Decimal('100.980'))
        self.assertEqual(len(dough['batches']), 2)
        self.assertEqual(sum(b['dough_mass_kg'] for b in dough['batches']), Decimal('100.980'))

    def test_batch_ingredients_are_scaled_to_batch_mass(self):
        self.order(self.bread_500, 50)

        batch = build_plan_preview(self.delivery)['doughs'][0]['batches'][0]

        # 50 * 0.55 * 1.02 = 28.05 kg ciasta
        self.assertEqual(batch['dough_mass_kg'], Decimal('28.050'))
        amounts = {i['name']: i['amount'] for i in batch['ingredients']}
        self.assertEqual(amounts, {'Mąka 750': Decimal('16.830'), 'Woda': Decimal('11.220')})

    def test_products_without_bake_spec_are_reported(self):
        self.order(self.cake, 5)

        preview = build_plan_preview(self.delivery)

        self.assertEqual(preview['doughs'], [])
        self.assertEqual(preview['unassigned_products'][0]['product_name'], 'Sernik')

    def test_ingredient_shortage_is_reported(self):
        self.order(self.bread_800, 100)  # 88 kg * 1.02 * 0.6 = 53.856 kg mąki przy stanie 50 kg

        totals = {t['name']: t for t in build_plan_preview(self.delivery)['ingredient_totals']}

        self.assertEqual(totals['Mąka 750']['shortage'], Decimal('3.856'))
        self.assertEqual(totals['Woda']['shortage'], Decimal('0.000'))

    def test_small_batch_warns_about_mixer_minimum(self):
        self.order(self.bread_500, 10)

        warnings = build_plan_preview(self.delivery)['doughs'][0]['warnings']

        self.assertTrue(any('minimalnego wsadu' in w for w in warnings))

    def test_missing_mixer_is_reported(self):
        self.mixer.is_active = False
        self.mixer.save()
        self.order(self.bread_500, 10)

        dough = build_plan_preview(self.delivery)['doughs'][0]

        self.assertEqual(dough['batches'], [])
        self.assertIsNone(dough['mixer'])
        self.assertTrue(dough['warnings'])

    def test_dough_specific_mixer_takes_precedence(self):
        small = Mixer.objects.create(name='Mała 40', max_capacity_kg=Decimal('40'))
        self.dough.mixer = small
        self.dough.save()
        self.order(self.bread_500, 100)  # 56.1 kg → 2 dzieże w mieszałce 40 kg

        dough = build_plan_preview(self.delivery)['doughs'][0]

        self.assertEqual(dough['mixer']['name'], 'Mała 40')
        self.assertEqual(len(dough['batches']), 2)


class GeneratePlanTests(PlanTestBase):
    def test_creates_batches_and_marks_orders_in_production(self):
        self.order(self.bread_500, 100)
        self.order(self.bread_800, 50)
        delivered = self.order(self.bread_800, 1, status='delivered')
        self.order(self.cake, 3)

        plan, _ = generate_plan(self.delivery, self.admin)

        self.assertEqual(plan.production_date, date(2026, 10, 12))
        batches = list(plan.batches.order_by('sequence'))
        self.assertEqual([(b.sequence, b.batch_count) for b in batches], [(1, 2), (2, 2)])
        self.assertEqual(sum(o.planned_pieces for b in batches for o in b.outputs.filter(product=self.bread_500)), 100)
        self.assertEqual(batches[0].ingredients.count(), 2)
        statuses = set(DailyOrder.objects.filter(product__in=[self.bread_500, self.bread_800]).exclude(pk=delivered.pk)
                       .values_list('status', flat=True))
        self.assertEqual(statuses, {'in_production'})
        self.assertEqual(DailyOrder.objects.get(product=self.cake).status, 'planned')
        delivered.refresh_from_db()
        self.assertEqual(delivered.status, 'delivered')

    def test_regenerates_while_nothing_started(self):
        self.order(self.bread_500, 10)
        generate_plan(self.delivery, self.admin)
        self.order(self.bread_500, 30)

        plan, _ = generate_plan(self.delivery, self.admin)

        self.assertEqual(ProductionPlan.objects.count(), 1)
        self.assertEqual(plan.lines.get().ordered_qty, 40)

    def test_refuses_to_regenerate_after_production_started(self):
        self.order(self.bread_500, 10)
        plan, _ = generate_plan(self.delivery, self.admin)
        ProductionBatch.objects.filter(plan=plan).update(stage='dividing')

        with self.assertRaises(PlanLockedError):
            generate_plan(self.delivery, self.admin)

    def test_refuses_empty_plan(self):
        self.order(self.cake, 3)

        with self.assertRaises(PlanningError):
            generate_plan(self.delivery, self.admin)
