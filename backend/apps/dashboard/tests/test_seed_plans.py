from datetime import date, timedelta

from django.test import TestCase

from dashboard.seed.clients import create_clients, create_routes
from dashboard.seed.dates import build_date_range
from dashboard.seed.orders import create_daily_orders, create_standing_orders
from dashboard.seed.plans import PLAN_DAYS, create_production_history
from dashboard.seed.production import create_production_setup
from dashboard.seed.products import create_ingredients, create_products
from production.models import BatchStageLog, ProductionBatch, ProductionPlan, WasteRecord
from users.models import User

TODAY = date(2026, 10, 21)


class SeedProductionHistoryTests(TestCase):
    def setUp(self):
        drivers = [
            User.objects.create_user(username=f'plan_driver{i}', password='x', role='driver', full_name=f'Driver {i}')
            for i in range(6)
        ]
        self.bakers = [
            User.objects.create_user(username=f'plan_baker{i}', password='x', role='baker', full_name=f'Baker {i}')
            for i in range(2)
        ]
        clients = create_clients(create_routes(drivers))
        ingredients = create_ingredients()
        products = create_products(ingredients)
        create_production_setup(ingredients, products)
        standing_orders = create_standing_orders(clients, products)
        create_daily_orders(clients, products, standing_orders, build_date_range(TODAY, 20))
        create_daily_orders(clients, products, standing_orders, [TODAY + timedelta(days=1)], TODAY)

    def test_recent_days_have_finished_plans(self):
        created_count = create_production_history(TODAY, self.bakers)

        self.assertEqual(created_count, PLAN_DAYS)
        self.assertEqual(ProductionPlan.objects.count(), PLAN_DAYS)
        self.assertFalse(ProductionPlan.objects.filter(delivery_date=TODAY + timedelta(days=1)).exists())
        plan = ProductionPlan.objects.get(delivery_date=TODAY)
        self.assertEqual(plan.production_date, TODAY - timedelta(days=1))
        self.assertFalse(ProductionBatch.objects.exclude(stage=ProductionBatch.STAGE_DONE).exists())
        self.assertFalse(ProductionBatch.objects.filter(completed_at__isnull=True).exists())

    def test_every_batch_has_a_trail_of_four_stages(self):
        create_production_history(TODAY, self.bakers)

        batch = ProductionBatch.objects.first()
        logs = list(batch.stage_logs.all())
        self.assertEqual([log.stage for log in logs], ['mixing', 'dividing', 'proofing', 'baking'])
        for earlier, later in zip(logs, logs[1:]):
            self.assertEqual(earlier.finished_at, later.started_at)
        self.assertEqual(logs[-1].finished_at, batch.completed_at)
        self.assertEqual(BatchStageLog.objects.count(), 4 * ProductionBatch.objects.count())
        self.assertTrue(WasteRecord.objects.exists())

    def test_is_idempotent(self):
        create_production_history(TODAY, self.bakers)

        self.assertEqual(create_production_history(TODAY, self.bakers), 0)