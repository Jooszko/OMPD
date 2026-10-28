from decimal import Decimal

from rest_framework.test import APIClient

from production.models import BatchStageLog, ProductionBatch
from production.services.lifecycle import (
    BatchActionError,
    StaleStageError,
    advance_stage,
    plan_coverage,
    record_waste,
    start_stage,
)
from production.services.planning import generate_plan
from products.models import IngredientStock
from users.models import Notification, User

from .test_planning import PlanTestBase


class BatchLifecycleTests(PlanTestBase):
    def setUp(self):
        super().setUp()
        self.order(self.bread_500, 40)
        self.order(self.bread_800, 10)
        self.plan, _ = generate_plan(self.delivery, self.admin)
        self.batch = self.plan.batches.get()

    def run_stage(self, user=None):
        user = user or self.baker
        start_stage(self.batch.pk, user, expected_stage=self.batch.stage)
        self.batch = advance_stage(self.batch.pk, user, expected_stage=self.batch.stage)

    def test_full_cycle_records_who_did_what(self):
        other = User.objects.create_user(username='piekarz2', password='x', role='baker', full_name='Ola')
        self.run_stage()
        self.run_stage(other)
        self.run_stage()
        self.run_stage(other)

        self.assertEqual(self.batch.stage, ProductionBatch.STAGE_DONE)
        self.assertIsNotNone(self.batch.completed_at)
        logs = list(BatchStageLog.objects.filter(batch=self.batch).values_list('stage', 'started_by__username', 'finished_by__username'))
        self.assertEqual(logs, [
            ('mixing', 'piekarz', 'piekarz'),
            ('dividing', 'piekarz2', 'piekarz2'),
            ('proofing', 'piekarz', 'piekarz'),
            ('baking', 'piekarz2', 'piekarz2'),
        ])

    def test_start_assigns_worker(self):
        batch = start_stage(self.batch.pk, self.baker, expected_stage='mixing')

        self.assertEqual(batch.stage_worker, self.baker)
        self.assertTrue(batch.is_stage_in_progress)

    def test_double_tap_on_start_is_rejected(self):
        start_stage(self.batch.pk, self.baker, expected_stage='mixing')

        with self.assertRaises(StaleStageError):
            start_stage(self.batch.pk, self.baker, expected_stage='mixing')

    def test_double_tap_on_advance_is_rejected(self):
        start_stage(self.batch.pk, self.baker, expected_stage='mixing')
        advance_stage(self.batch.pk, self.baker, expected_stage='mixing')

        with self.assertRaises(StaleStageError):
            advance_stage(self.batch.pk, self.baker, expected_stage='mixing')

    def test_cannot_advance_without_starting(self):
        with self.assertRaises(BatchActionError):
            advance_stage(self.batch.pk, self.baker, expected_stage='mixing')

    def test_finishing_mixing_consumes_ingredients(self):
        flour_before = IngredientStock.objects.get(ingredient=self.flour).current_stock
        amount = self.batch.ingredients.get(ingredient=self.flour).amount

        self.run_stage()

        stock = IngredientStock.objects.get(ingredient=self.flour)
        self.assertEqual(stock.current_stock, flour_before - amount)
        self.assertEqual(stock.min_stock_level, amount)

    def test_completed_batch_moves_good_pieces_to_finished_goods(self):
        self.run_stage()
        record_waste(self.batch.pk, self.baker, self.bread_500.pk, 3, 'burnt')
        for _ in range(3):
            self.run_stage()

        self.bread_500.refresh_from_db()
        self.bread_800.refresh_from_db()
        self.assertEqual(self.bread_500.current_stock, 37)
        self.assertEqual(self.bread_800.current_stock, 10)
        coverage = {row['product_id']: row for row in plan_coverage(self.plan)}
        self.assertEqual(coverage[self.bread_500.pk]['finished_qty'], 37)

    def test_waste_updates_coverage_and_notifies_managers(self):
        record, row = record_waste(self.batch.pk, self.baker, self.bread_800.pk, 2, 'damaged')

        self.assertEqual(record.stage, 'mixing')
        self.assertEqual(row['expected_qty'], 8)
        self.assertEqual(row['shortfall'], 2)
        notification = Notification.objects.get(user=self.admin)
        self.assertIn('brakuje 2 szt.', notification.message)

    def test_waste_cannot_exceed_planned_pieces(self):
        record_waste(self.batch.pk, self.baker, self.bread_800.pk, 8, 'damaged')

        with self.assertRaises(BatchActionError):
            record_waste(self.batch.pk, self.baker, self.bread_800.pk, 3, 'damaged')

    def test_waste_for_product_outside_batch_is_rejected(self):
        with self.assertRaises(BatchActionError):
            record_waste(self.batch.pk, self.baker, self.cake.pk, 1, 'damaged')

    def test_unknown_waste_reason_is_rejected(self):
        with self.assertRaises(BatchActionError):
            record_waste(self.batch.pk, self.baker, self.bread_800.pk, 1, 'bored')


class ProductionApiTests(PlanTestBase):
    def setUp(self):
        super().setUp()
        self.order(self.bread_500, 40)
        self.api = APIClient()

    def as_user(self, user):
        self.api.force_authenticate(user)
        return self.api

    def test_driver_has_no_access(self):
        driver = User.objects.create_user(username='kierowca', password='x', role='driver')

        response = self.as_user(driver).get('/api/production/board/', {'delivery_date': str(self.delivery)})

        self.assertEqual(response.status_code, 403)

    def test_only_manager_generates_plan(self):
        response = self.as_user(self.baker).post('/api/production/plan/', {'delivery_date': str(self.delivery)})
        self.assertEqual(response.status_code, 403)

        response = self.as_user(self.admin).post('/api/production/plan/', {'delivery_date': str(self.delivery)}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data['plan']['locked'])

    def test_plan_preview_and_board(self):
        api = self.as_user(self.baker)
        preview = api.get('/api/production/plan/', {'delivery_date': str(self.delivery)})
        self.assertEqual(preview.status_code, 200)
        self.assertIsNone(preview.data['plan'])
        self.assertEqual(preview.data['preview']['doughs'][0]['name'], 'Ciasto wiejskie')

        generate_plan(self.delivery, self.admin)
        board = api.get('/api/production/board/', {'delivery_date': str(self.delivery)})

        self.assertEqual(board.status_code, 200)
        batch = board.data['batches'][0]
        self.assertEqual(batch['stage'], 'mixing')
        self.assertEqual(batch['next_stage'], 'dividing')
        self.assertEqual(batch['outputs'][0]['planned_pieces'], 40)
        self.assertEqual(board.data['coverage'][0]['shortfall'], 0)

    def test_stage_actions_over_http(self):
        plan, _ = generate_plan(self.delivery, self.admin)
        batch = plan.batches.get()
        api = self.as_user(self.baker)
        url = f'/api/production/batches/{batch.pk}'

        started = api.post(f'{url}/start/', {'stage': 'mixing'}, format='json')
        self.assertEqual(started.status_code, 200)
        self.assertEqual(started.data['batch']['stage_worker']['full_name'], 'Jan Piekarz')

        stale = api.post(f'{url}/start/', {'stage': 'mixing'}, format='json')
        self.assertEqual(stale.status_code, 409)

        advanced = api.post(f'{url}/advance/', {'stage': 'mixing'}, format='json')
        self.assertEqual(advanced.data['batch']['stage'], 'dividing')

        waste = api.post(
            f'{url}/waste/', {'product_id': self.bread_500.pk, 'quantity': 2, 'reason': 'misshaped'}, format='json'
        )
        self.assertEqual(waste.status_code, 200)
        self.assertEqual(waste.data['shortfall'], 2)
        self.assertEqual(waste.data['batch']['outputs'][0]['good_pieces'], 38)

        invalid = api.post(f'{url}/waste/', {'product_id': self.bread_500.pk, 'quantity': 'x'}, format='json')
        self.assertEqual(invalid.status_code, 400)

    def test_regenerating_started_plan_conflicts(self):
        plan, _ = generate_plan(self.delivery, self.admin)
        start_stage(plan.batches.get().pk, self.baker)

        response = self.as_user(self.admin).post('/api/production/plan/', {'delivery_date': str(self.delivery)}, format='json')

        self.assertEqual(response.status_code, 409)

    def test_missing_batch_returns_404(self):
        response = self.as_user(self.baker).post('/api/production/batches/9999/start/', {}, format='json')

        self.assertEqual(response.status_code, 404)

    def test_coverage_counts_ordered_pieces_exactly(self):
        plan, _ = generate_plan(self.delivery, self.admin)

        coverage = plan_coverage(plan)

        self.assertEqual(coverage[0]['ordered_qty'], 40)
        self.assertEqual(coverage[0]['planned_qty'], 40)
        self.assertEqual(Decimal(plan.batches.get().dough_mass_kg), Decimal('22.440'))
