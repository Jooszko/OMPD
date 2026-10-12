from datetime import date

from django.db.models import Prefetch
from rest_framework import status as http_status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import BatchStageLog, ProductionBatch, ProductionPlan, WasteRecord
from .services.lifecycle import (
    BatchActionError,
    StaleStageError,
    advance_stage,
    plan_coverage,
    record_waste,
    start_stage,
    good_pieces_by_product,
)
from .services.planning import (
    PlanLockedError,
    PlanningError,
    build_plan_preview,
    delivery_date_for,
    generate_plan,
    plan_is_locked,
    production_date_for,
)

PRODUCTION_ROLES = ('admin', 'baker')


def _forbidden():
    return Response({'error': 'Brak uprawnień do modułu produkcji.'}, status=http_status.HTTP_403_FORBIDDEN)


def _delivery_date(request, source):
    """Data dostawy z żądania; domyślnie dostawa, na którą piecze dzisiejsza zmiana."""
    raw = source.get('delivery_date')
    if not raw:
        return delivery_date_for(date.today())
    return date.fromisoformat(raw)


def _person(user):
    if user is None:
        return None
    return {'user_id': user.user_id, 'full_name': user.full_name or user.username}


def _batch_queryset():
    return (
        ProductionBatch.objects
        .select_related('dough', 'mixer', 'stage_worker', 'plan')
        .prefetch_related(
            'ingredients__ingredient',
            'outputs__product',
            Prefetch('stage_logs', queryset=BatchStageLog.objects.select_related('started_by', 'finished_by')),
            Prefetch('waste_records', queryset=WasteRecord.objects.select_related('product', 'recorded_by')),
        )
    )


def _batch_payload(batch):
    stage_labels = dict(ProductionBatch.STAGE_CHOICES)
    good = good_pieces_by_product(batch)
    outputs = sorted(batch.outputs.all(), key=lambda o: o.product.name)
    return {
        'batch_id': batch.batch_id,
        'dough_id': batch.dough_id,
        'dough_name': batch.dough.name,
        'sequence': batch.sequence,
        'batch_count': batch.batch_count,
        'dough_mass_kg': batch.dough_mass_kg,
        'mixer_name': batch.mixer.name if batch.mixer else None,
        'stage': batch.stage,
        'stage_label': batch.get_stage_display(),
        'next_stage': batch.next_stage,
        'next_stage_label': stage_labels.get(batch.next_stage),
        'stage_started_at': batch.stage_started_at,
        'stage_worker': _person(batch.stage_worker),
        'completed_at': batch.completed_at,
        'mixing': {
            'instructions': batch.dough.mixing_instructions,
            'mixing_time_min': batch.dough.mixing_time_min,
            'target_dough_temp_c': batch.dough.target_dough_temp_c,
        },
        'proofing_time_min': batch.dough.proofing_time_min,
        'ingredients': [
            {
                'ingredient_id': item.ingredient_id,
                'name': item.ingredient.name,
                'unit': item.ingredient.unit,
                'amount': item.amount,
            }
            for item in sorted(batch.ingredients.all(), key=lambda i: -i.amount)
        ],
        'outputs': [
            {
                'product_id': o.product_id,
                'product_name': o.product.name,
                'planned_pieces': o.planned_pieces,
                'waste_pieces': o.planned_pieces - good[o.product_id],
                'good_pieces': good[o.product_id],
                'piece_weight_kg': o.piece_weight_kg,
                'bake_temp_c': o.bake_temp_c,
                'bake_time_min': o.bake_time_min,
            }
            for o in outputs
        ],
        'history': [
            {
                'stage': log.stage,
                'stage_label': stage_labels[log.stage],
                'started_by': _person(log.started_by),
                'started_at': log.started_at,
                'finished_by': _person(log.finished_by),
                'finished_at': log.finished_at,
            }
            for log in batch.stage_logs.all()
        ],
        'waste': [
            {
                'waste_id': w.waste_id,
                'product_id': w.product_id,
                'product_name': w.product.name,
                'stage': w.stage,
                'stage_label': w.get_stage_display(),
                'quantity': w.quantity,
                'reason': w.reason,
                'reason_label': w.get_reason_display(),
                'recorded_by': _person(w.recorded_by),
                'created_at': w.created_at,
            }
            for w in batch.waste_records.all()
        ],
    }


def _plan_summary(plan):
    return {
        'plan_id': plan.plan_id,
        'created_at': plan.created_at,
        'created_by': _person(plan.created_by),
        'locked': plan_is_locked(plan),
    }


class ProductionPlanView(APIView):
    """Podgląd agregacji (GET) i zapis planu z podziałem na dzieże (POST, tylko kierownik)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in PRODUCTION_ROLES:
            return _forbidden()
        try:
            delivery_date = _delivery_date(request, request.query_params)
        except ValueError:
            return Response({'error': 'Nieprawidłowy format daty.'}, status=http_status.HTTP_400_BAD_REQUEST)

        plan = ProductionPlan.objects.select_related('created_by').filter(delivery_date=delivery_date).first()
        return Response({
            'preview': build_plan_preview(delivery_date),
            'plan': _plan_summary(plan) if plan else None,
        })

    def post(self, request):
        if request.user.role != 'admin':
            return Response(
                {'error': 'Plan produkcji może wygenerować tylko kierownik.'}, status=http_status.HTTP_403_FORBIDDEN
            )
        try:
            delivery_date = _delivery_date(request, request.data)
        except (TypeError, ValueError):
            return Response({'error': 'Nieprawidłowy format daty.'}, status=http_status.HTTP_400_BAD_REQUEST)

        try:
            plan, preview = generate_plan(delivery_date, request.user)
        except PlanLockedError as exc:
            return Response({'error': str(exc)}, status=http_status.HTTP_409_CONFLICT)
        except PlanningError as exc:
            return Response({'error': str(exc)}, status=http_status.HTTP_400_BAD_REQUEST)

        return Response(
            {'preview': preview, 'plan': _plan_summary(plan)}, status=http_status.HTTP_201_CREATED
        )


class ProductionBoardView(APIView):
    """Tablica produkcyjna zmiany: wszystkie dzieże planu i pokrycie zamówień."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in PRODUCTION_ROLES:
            return _forbidden()
        try:
            delivery_date = _delivery_date(request, request.query_params)
        except ValueError:
            return Response({'error': 'Nieprawidłowy format daty.'}, status=http_status.HTTP_400_BAD_REQUEST)

        plan = ProductionPlan.objects.select_related('created_by').filter(delivery_date=delivery_date).first()
        batches = _batch_queryset().filter(plan=plan).order_by('dough__name', 'sequence') if plan else []
        return Response({
            'delivery_date': delivery_date,
            'production_date': production_date_for(delivery_date),
            'plan': _plan_summary(plan) if plan else None,
            'batches': [_batch_payload(b) for b in batches],
            'coverage': plan_coverage(plan) if plan else [],
            'viewer': {**_person(request.user), 'role': request.user.role},
            'waste_reasons': [{'value': v, 'label': l} for v, l in WasteRecord.REASON_CHOICES],
        })


class _BatchActionView(APIView):
    permission_classes = [IsAuthenticated]

    def perform(self, request, pk):
        raise NotImplementedError

    def post(self, request, pk):
        if request.user.role not in PRODUCTION_ROLES:
            return _forbidden()
        if not ProductionBatch.objects.filter(pk=pk).exists():
            return Response({'error': 'Nie znaleziono dzieży.'}, status=http_status.HTTP_404_NOT_FOUND)
        try:
            extra = self.perform(request, pk) or {}
        except StaleStageError as exc:
            return Response({'error': str(exc)}, status=http_status.HTTP_409_CONFLICT)
        except BatchActionError as exc:
            return Response({'error': str(exc)}, status=http_status.HTTP_400_BAD_REQUEST)

        batch = _batch_queryset().get(pk=pk)
        return Response({
            'batch': _batch_payload(batch),
            'coverage': plan_coverage(batch.plan),
            **extra,
        })


class BatchStartStageView(_BatchActionView):
    def perform(self, request, pk):
        start_stage(pk, request.user, expected_stage=request.data.get('stage'))


class BatchAdvanceStageView(_BatchActionView):
    def perform(self, request, pk):
        advance_stage(pk, request.user, expected_stage=request.data.get('stage'))


class BatchWasteView(_BatchActionView):
    def perform(self, request, pk):
        try:
            product_id = int(request.data.get('product_id'))
            quantity = int(request.data.get('quantity'))
        except (TypeError, ValueError):
            raise BatchActionError('Podaj wyrób i liczbę sztuk.')
        record, coverage_row = record_waste(pk, request.user, product_id, quantity, request.data.get('reason'))
        return {
            'waste_id': record.waste_id,
            'shortfall': coverage_row['shortfall'] if coverage_row else 0,
        }
