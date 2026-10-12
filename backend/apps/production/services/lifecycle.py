"""Cykl życia dzieży: etapy technologiczne, ślad pracy, straty i pokrycie zamówień."""
from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone

from products.models import IngredientStock, Product
from users.models import Notification, User

from ..models import BatchStageLog, PlanLine, ProductionBatch, WasteRecord


class BatchActionError(Exception):
    """Akcja niedozwolona w obecnym stanie dzieży."""


class StaleStageError(BatchActionError):
    """Klient działał na nieaktualnym stanie (np. podwójne dotknięcie albo inny piekarz był szybszy)."""


def _locked_batch(batch_id, expected_stage):
    batch = ProductionBatch.objects.select_for_update().select_related('plan').get(pk=batch_id)
    if expected_stage is not None and batch.stage != expected_stage:
        raise StaleStageError(
            f'Dzieża jest już na etapie „{batch.get_stage_display()}”. Odśwież tablicę.'
        )
    if batch.stage == ProductionBatch.STAGE_DONE:
        raise BatchActionError('Dzieża jest już zakończona.')
    return batch


@transaction.atomic
def start_stage(batch_id, user, expected_stage=None):
    batch = _locked_batch(batch_id, expected_stage)
    if batch.is_stage_in_progress:
        raise StaleStageError('Ten etap jest już w toku.')

    now = timezone.now()
    batch.stage_started_at = now
    batch.stage_worker = user
    batch.save(update_fields=['stage_started_at', 'stage_worker', 'updated_at'])
    BatchStageLog.objects.create(batch=batch, stage=batch.stage, started_by=user, started_at=now)
    return batch


@transaction.atomic
def advance_stage(batch_id, user, expected_stage=None):
    batch = _locked_batch(batch_id, expected_stage)
    if not batch.is_stage_in_progress:
        raise BatchActionError('Najpierw rozpocznij etap.')

    now = timezone.now()
    BatchStageLog.objects.filter(batch=batch, stage=batch.stage, finished_at__isnull=True).update(
        finished_by=user, finished_at=now
    )

    if batch.stage == ProductionBatch.STAGE_MIXING:
        _consume_ingredients(batch)

    batch.stage = batch.next_stage
    batch.stage_started_at = None
    batch.stage_worker = None
    if batch.stage == ProductionBatch.STAGE_DONE:
        batch.completed_at = now
        _receive_finished_goods(batch)
    batch.save(update_fields=['stage', 'stage_started_at', 'stage_worker', 'completed_at', 'updated_at'])
    return batch


def _consume_ingredients(batch):
    """Odważone surowce schodzą ze stanu magazynu po zakończeniu mieszania."""
    for item in batch.ingredients.all():
        IngredientStock.objects.filter(ingredient_id=item.ingredient_id).update(
            current_stock=F('current_stock') - item.amount
        )


def good_pieces_by_product(batch):
    waste = dict(
        batch.waste_records.values('product_id').annotate(total=Sum('quantity')).values_list('product_id', 'total')
    )
    return {
        output.product_id: max(0, output.planned_pieces - waste.get(output.product_id, 0))
        for output in batch.outputs.all()
    }


def _receive_finished_goods(batch):
    """Koniec partii: dobre sztuki trafiają na magazyn wyrobów gotowych."""
    for product_id, pieces in good_pieces_by_product(batch).items():
        if pieces:
            Product.objects.filter(pk=product_id).update(current_stock=F('current_stock') + pieces)


@transaction.atomic
def record_waste(batch_id, user, product_id, quantity, reason):
    batch = _locked_batch(batch_id, expected_stage=None)
    output = batch.outputs.filter(product_id=product_id).select_related('product').first()
    if output is None:
        raise BatchActionError('Ten wyrób nie jest produkowany w tej dzieży.')
    if reason not in dict(WasteRecord.REASON_CHOICES):
        raise BatchActionError('Nieznany powód straty.')
    if quantity <= 0:
        raise BatchActionError('Ilość straty musi być większa od zera.')

    already = batch.waste_records.filter(product_id=product_id).aggregate(total=Sum('quantity'))['total'] or 0
    if already + quantity > output.planned_pieces:
        raise BatchActionError(
            f'Strata przekracza liczbę kęsów w dzieży (zaplanowano {output.planned_pieces}, '
            f'zgłoszono już {already}).'
        )

    record = WasteRecord.objects.create(
        batch=batch, product_id=product_id, stage=batch.stage,
        quantity=quantity, reason=reason, recorded_by=user,
    )

    coverage = {row['product_id']: row for row in plan_coverage(batch.plan)}
    row = coverage.get(product_id)
    if row and row['shortfall'] > 0:
        _notify_admins_about_shortfall(user, batch, record, row)
    return record, row


def _notify_admins_about_shortfall(sender, batch, record, row):
    title = f'Strata w produkcji: {row["product_name"]}'
    message = (
        f'{sender.full_name or sender.username} zgłosił(a) stratę {record.quantity} szt. '
        f'({record.get_reason_display().lower()}) w dzieży {batch.dough.name} #{batch.sequence} '
        f'na etapie „{record.get_stage_display()}”. Dostawa {batch.plan.delivery_date:%d.%m.%Y}: '
        f'zamówiono {row["ordered_qty"]} szt., przewidywane {row["expected_qty"]} szt. — '
        f'brakuje {row["shortfall"]} szt.'
    )
    admins = User.objects.filter(role='admin', is_active=True).exclude(pk=sender.pk)
    Notification.objects.bulk_create([
        Notification(user=admin, sender=sender, title=title, message=message) for admin in admins
    ])


def plan_coverage(plan):
    """Czy zamówienia zostaną pokryte: zamówione vs zaplanowane minus straty."""
    lines = {
        line.product_id: line
        for line in PlanLine.objects.filter(plan=plan).select_related('product')
    }
    planned = dict(
        ProductionBatch.objects.filter(plan=plan)
        .values('outputs__product_id').annotate(total=Sum('outputs__planned_pieces'))
        .values_list('outputs__product_id', 'total')
    )
    wasted = dict(
        WasteRecord.objects.filter(batch__plan=plan)
        .values('product_id').annotate(total=Sum('quantity')).values_list('product_id', 'total')
    )
    finished = {}
    for batch in plan.batches.filter(stage=ProductionBatch.STAGE_DONE).prefetch_related('outputs'):
        for product_id, pieces in good_pieces_by_product(batch).items():
            finished[product_id] = finished.get(product_id, 0) + pieces

    rows = []
    for product_id, line in lines.items():
        planned_qty = planned.get(product_id) or 0
        waste_qty = wasted.get(product_id, 0)
        expected = max(0, planned_qty - waste_qty)
        rows.append({
            'product_id': product_id,
            'product_name': line.product.name,
            'ordered_qty': line.ordered_qty,
            'planned_qty': planned_qty,
            'waste_qty': waste_qty,
            'expected_qty': expected,
            'finished_qty': finished.get(product_id, 0),
            'shortfall': max(0, line.ordered_qty - expected),
        })
    return sorted(rows, key=lambda r: r['product_name'])
