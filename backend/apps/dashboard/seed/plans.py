from datetime import datetime, time, timedelta

from production.models import BatchStageLog, ProductionBatch, ProductionPlan, WasteRecord
from production.services.planning import PlanningError, generate_plan

from dashboard.seed.orders import SEED_TIMEZONE

PLAN_DAYS = 14
PLAN_CREATED_AT = time(16, 0)
SHIFT_START = time(20, 0)
BATCH_GAP_MINUTES = 20
DIVIDING_MINUTES = 20
WASTE_EVERY = 6
WASTE_REASONS = ['damaged', 'misshaped', 'overproofed', 'burnt']


def _stage_minutes(batch):
    return [
        (ProductionBatch.STAGE_MIXING, batch.dough.mixing_time_min),
        (ProductionBatch.STAGE_DIVIDING, DIVIDING_MINUTES),
        (ProductionBatch.STAGE_PROOFING, batch.dough.proofing_time_min),
        (ProductionBatch.STAGE_BAKING, max(output.bake_time_min for output in batch.outputs.all())),
    ]


def _finish_plan(plan, bakers):
    shift_start = datetime.combine(plan.production_date, SHIFT_START, tzinfo=SEED_TIMEZONE)
    batches = list(plan.batches.select_related('dough').prefetch_related('outputs').order_by('batch_id'))
    logs = []
    waste = []
    for index, batch in enumerate(batches):
        seed = plan.plan_id + index
        baker = bakers[seed % len(bakers)]
        moment = shift_start + timedelta(minutes=index * BATCH_GAP_MINUTES)
        for stage, minutes in _stage_minutes(batch):
            finished = moment + timedelta(minutes=minutes)
            logs.append(BatchStageLog(
                batch=batch, stage=stage, started_by=baker, started_at=moment, finished_by=baker, finished_at=finished,
            ))
            moment = finished
        batch.stage = ProductionBatch.STAGE_DONE
        batch.completed_at = moment
        if seed % WASTE_EVERY == 0:
            output = batch.outputs.all()[0]
            waste.append(WasteRecord(
                batch=batch,
                product_id=output.product_id,
                stage=ProductionBatch.STAGE_BAKING,
                quantity=min(output.planned_pieces, 2 + seed % 5),
                reason=WASTE_REASONS[seed % len(WASTE_REASONS)],
                recorded_by=baker,
            ))
    ProductionBatch.objects.bulk_update(batches, ['stage', 'completed_at'])
    BatchStageLog.objects.bulk_create(logs)
    WasteRecord.objects.bulk_create(waste)


def create_production_history(today, bakers):
    created_count = 0
    for offset in range(PLAN_DAYS - 1, -1, -1):
        delivery_date = today - timedelta(days=offset)
        if ProductionPlan.objects.filter(delivery_date=delivery_date).exists():
            continue
        try:
            plan, _ = generate_plan(delivery_date, bakers[0])
        except PlanningError:
            continue
        created_at = datetime.combine(plan.production_date, PLAN_CREATED_AT, tzinfo=SEED_TIMEZONE)
        ProductionPlan.objects.filter(pk=plan.pk).update(created_at=created_at, updated_at=created_at)
        _finish_plan(plan, bakers)
        created_count += 1
    return created_count