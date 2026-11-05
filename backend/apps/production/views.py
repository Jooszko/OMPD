from datetime import date, timedelta

from django.db import transaction
from django.db.models import Prefetch, ProtectedError
from django.shortcuts import get_object_or_404
from rest_framework import status as http_status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema, extend_schema_view

from common.losses import LOSS_BUFFER_PCT
from products.models import Ingredient, Product

from . import audit as production_audit
from .models import BatchStageLog, Dough, Mixer, ProductBakeSpec, ProductionBatch, ProductionPlan, WasteRecord
from .serializers import BakeSpecSerializer, DoughSerializer, MixerSerializer
from .services import recipes
from .services.recommend import recommend_doughs
from common.openapi import error_response
from .openapi import (
    DELIVERY_DATE_PARAM, FORBIDDEN, FORM_ERROR, NOT_FOUND, BakeSpecRowSerializer, BatchActionResultSerializer,
    DeliveryDateInputSerializer, DoughSuggestionsSerializer, PlanCalendarDaySerializer, ProductionBoardSerializer,
    ProductionPlanSerializer, ProductionSettingsSerializer, StageInputSerializer, WasteInputSerializer,
    WasteResultSerializer,
)
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
    current_production_date,
    delivery_date_for,
    generate_plan,
    plan_calendar,
    plan_is_locked,
    plan_overview,
    production_date_for,
)

CALENDAR_DAYS = 7

PRODUCTION_ROLES = ('admin', 'baker')


def _forbidden():
    return Response({'error': 'Brak uprawnień do modułu produkcji.'}, status=http_status.HTTP_403_FORBIDDEN)


def _delivery_date(request, source):
    """Data dostawy z żądania; domyślnie dostawa, na którą piecze dzisiejsza zmiana."""
    raw = source.get('delivery_date')
    if not raw:
        return delivery_date_for(current_production_date())
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


class ProductionCalendarView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Kalendarz planów produkcji',
        description='Status planu dla 7 kolejnych dni dostawy od daty start (domyślnie 3 dni przed bieżącą dostawą).',
        parameters=[OpenApiParameter('start', str, description='Pierwszy dzień dostawy, RRRR-MM-DD.')],
        responses={
            200: PlanCalendarDaySerializer(many=True),
            400: error_response('Błędny format daty.'),
            403: FORBIDDEN,
        },
    )
    def get(self, request):
        if request.user.role not in PRODUCTION_ROLES:
            return _forbidden()
        raw = request.query_params.get('start')
        try:
            start = date.fromisoformat(raw) if raw else delivery_date_for(current_production_date()) - timedelta(days=3)
        except ValueError:
            return Response({'error': 'Nieprawidłowy format daty.'}, status=http_status.HTTP_400_BAD_REQUEST)
        return Response(PlanCalendarDaySerializer(plan_calendar(start, CALENDAR_DAYS), many=True).data)


class ProductionPlanView(APIView):
    """Podgląd agregacji (GET) i zapis planu z podziałem na dzieże (POST, tylko kierownik)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Plan produkcji',
        description=(
            'Zapotrzebowanie z zamówień rozpisane na ciasta, dzieże i odważenia surowców, z bilansem magazynu. '
            'Po zatwierdzeniu planu – zapisane dzieże i zmiany zamówień od tego momentu.'
        ),
        parameters=[DELIVERY_DATE_PARAM],
        responses={200: ProductionPlanSerializer, 400: error_response('Błędny format daty.'), 403: FORBIDDEN},
    )
    def get(self, request):
        if request.user.role not in PRODUCTION_ROLES:
            return _forbidden()
        try:
            delivery_date = _delivery_date(request, request.query_params)
        except ValueError:
            return Response({'error': 'Nieprawidłowy format daty.'}, status=http_status.HTTP_400_BAD_REQUEST)

        plan = ProductionPlan.objects.select_related('created_by').filter(delivery_date=delivery_date).first()
        preview, changes = plan_overview(delivery_date, plan)
        return Response({
            'preview': preview,
            'plan': _plan_summary(plan) if plan else None,
            'order_changes': changes,
        })

    @extend_schema(
        summary='Zatwierdzenie planu produkcji',
        description='Zapisuje plan i tworzy dzieże na tablicy produkcji. Tylko kierownik, dopóki produkcja nie ruszyła.',
        request=DeliveryDateInputSerializer,
        responses={
            201: ProductionPlanSerializer,
            400: error_response('Błędna data albo planu nie da się wyliczyć.'),
            403: FORBIDDEN,
            409: error_response('Produkcja według tego planu już ruszyła.'),
        },
    )
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
            with transaction.atomic():
                previous = ProductionPlan.objects.filter(delivery_date=delivery_date).first()
                before = production_audit.plan_state(previous)
                plan, preview = generate_plan(delivery_date, request.user)
                production_audit.plan_generated(request, plan, preview, before)
        except PlanLockedError as exc:
            return Response({'error': str(exc)}, status=http_status.HTTP_409_CONFLICT)
        except PlanningError as exc:
            return Response({'error': str(exc)}, status=http_status.HTTP_400_BAD_REQUEST)

        return Response(
            {'preview': preview, 'plan': _plan_summary(plan), 'order_changes': []},
            status=http_status.HTTP_201_CREATED,
        )


class ProductionBoardView(APIView):
    """Tablica produkcyjna zmiany: wszystkie dzieże planu i pokrycie zamówień."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Tablica produkcji',
        description='Wszystkie dzieże zatwierdzonego planu z etapami, odważeniami i stratami oraz pokrycie zamówień.',
        parameters=[DELIVERY_DATE_PARAM],
        responses={200: ProductionBoardSerializer, 400: error_response('Błędny format daty.'), 403: FORBIDDEN},
    )
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
            with transaction.atomic():
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

@extend_schema_view(post=extend_schema(
    summary='Rozpoczęcie etapu dzieży',
    description='Piekarz bierze dzieżę do pracy na bieżącym etapie.',
    request=StageInputSerializer,
    responses={
        200: BatchActionResultSerializer,
        400: error_response('Akcja niemożliwa na tym etapie albo błędne dane.'),
        403: FORBIDDEN,
        404: error_response('Nie znaleziono dzieży.'),
        409: error_response('Dzieża jest już na innym etapie – odśwież tablicę.'),
    },
))
class BatchStartStageView(_BatchActionView):
    def perform(self, request, pk):
        start_stage(pk, request.user, expected_stage=request.data.get('stage'))

@extend_schema_view(post=extend_schema(
    summary='Zakończenie etapu dzieży',
    description='Kończy bieżący etap i przesuwa dzieżę na następny.',
    request=StageInputSerializer,
    responses={
        200: BatchActionResultSerializer,
        400: error_response('Akcja niemożliwa na tym etapie albo błędne dane.'),
        403: FORBIDDEN,
        404: error_response('Nie znaleziono dzieży.'),
        409: error_response('Dzieża jest już na innym etapie – odśwież tablicę.'),
    },
))
class BatchAdvanceStageView(_BatchActionView):
    def perform(self, request, pk):
        advanced = advance_stage(pk, request.user, expected_stage=request.data.get('stage'))
        finished_stage = ProductionBatch.STAGE_ORDER[ProductionBatch.STAGE_ORDER.index(advanced.stage) - 1]
        batch = ProductionBatch.objects.select_related('dough', 'plan').get(pk=pk)
        production_audit.stage_completed(request, batch, finished_stage)

@extend_schema_view(post=extend_schema(
    summary='Zapisanie strat w dzieży',
    description='Zapisuje zepsute sztuki wyrobu i zwraca, ilu sztuk zabraknie do zamówień.',
    request=WasteInputSerializer,
    responses={
        200: WasteResultSerializer,
        400: error_response('Akcja niemożliwa na tym etapie albo błędne dane.'),
        403: FORBIDDEN,
        404: error_response('Nie znaleziono dzieży.'),
        409: error_response('Dzieża jest już na innym etapie – odśwież tablicę.'),
    },
))
class BatchWasteView(_BatchActionView):
    def perform(self, request, pk):
        try:
            product_id = int(request.data.get('product_id'))
            quantity = int(request.data.get('quantity'))
        except (TypeError, ValueError):
            raise BatchActionError('Podaj wyrób i liczbę sztuk.')
        record, coverage_row = record_waste(pk, request.user, product_id, quantity, request.data.get('reason'))
        batch = ProductionBatch.objects.select_related('dough', 'plan').get(pk=pk)
        production_audit.waste_recorded(request, batch, record, coverage_row)
        return {
            'waste_id': record.waste_id,
            'shortfall': coverage_row['shortfall'] if coverage_row else 0,
        }


# ---------------------------------------------------------------------------
# Ustawienia produkcji (odczyt: kierownik i piekarz, zapis: tylko kierownik)
# ---------------------------------------------------------------------------


def _only_admin(request):
    if request.user.role != 'admin':
        return Response(
            {'error': 'Ustawienia produkcji może zmieniać tylko kierownik.'}, status=http_status.HTTP_403_FORBIDDEN
        )
    return None


def _first_error(errors):
    """Pierwszy komunikat z błędów serializera — do wyświetlenia w jednym miejscu formularza."""
    if isinstance(errors, dict):
        for value in errors.values():
            return _first_error(value)
    if isinstance(errors, list) and errors:
        return _first_error(errors[0])
    return str(errors)


def _invalid(serializer):
    return Response(
        {'error': _first_error(serializer.errors), 'fields': serializer.errors},
        status=http_status.HTTP_400_BAD_REQUEST,
    )


def _dough_queryset():
    return Dough.objects.select_related('mixer').prefetch_related('dough_ingredients__ingredient', 'bake_specs')


def _bake_spec_row(product):
    spec = getattr(product, 'bake_spec', None)
    return {
        'product_id': product.product_id,
        'product_name': product.name,
        'category': product.category,
        'spec': None if spec is None else {**BakeSpecSerializer(spec).data, 'dough_name': spec.dough.name},
    }


class ProductionSettingsView(APIView):
    """Wszystko, czego potrzebuje ekran ustawień, w jednym zapytaniu.

    Lista wyrobów obejmuje też te bez parametrów, żeby kierownik widział, czego brakuje w planowaniu.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Ustawienia produkcji',
        description='Mieszałki, ciasta z recepturami, parametry wypieku wyrobów i lista surowców w jednym zapytaniu.',
        responses={200: ProductionSettingsSerializer, 403: FORBIDDEN},
    )
    def get(self, request):
        if request.user.role not in PRODUCTION_ROLES:
            return _forbidden()
        products = Product.objects.select_related('bake_spec__dough').order_by('name')
        return Response({
            'mixers': MixerSerializer(Mixer.objects.order_by('-is_active', 'name'), many=True).data,
            'doughs': DoughSerializer(_dough_queryset().order_by('name'), many=True).data,
            'products': [_bake_spec_row(p) for p in products],
            'ingredients': [
                {'ingredient_id': i.ingredient_id, 'name': i.name, 'unit': i.unit}
                for i in Ingredient.objects.order_by('name')
            ],
            'loss_buffer_pct': str(LOSS_BUFFER_PCT),
        })


class MixerListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Dodanie mieszałki',
        request=MixerSerializer,
        responses={201: MixerSerializer, 400: FORM_ERROR, 403: FORBIDDEN},
    )
    def post(self, request):
        if denied := _only_admin(request):
            return denied
        serializer = MixerSerializer(data=request.data)
        if not serializer.is_valid():
            return _invalid(serializer)
        with transaction.atomic():
            mixer = serializer.save()
            production_audit.mixer_saved(request, mixer, before={})
        return Response(serializer.data, status=http_status.HTTP_201_CREATED)


class MixerDetailView(APIView):
    """Mieszałek się nie usuwa (odwołują się do nich historyczne dzieże) — wyłącza się je flagą is_active."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Zmiana lub wyłączenie mieszałki',
        description='Mieszałek się nie usuwa – wyłącza się je polem is_active.',
        request=MixerSerializer,
        responses={200: MixerSerializer, 400: FORM_ERROR, 403: FORBIDDEN, 404: NOT_FOUND},
    )
    def patch(self, request, pk):
        if denied := _only_admin(request):
            return denied
        mixer = get_object_or_404(Mixer, pk=pk)
        before = production_audit.mixer_state(mixer)
        serializer = MixerSerializer(mixer, data=request.data, partial=True)
        if not serializer.is_valid():
            return _invalid(serializer)
        with transaction.atomic():
            mixer = serializer.save()
            production_audit.mixer_saved(request, mixer, before)
        return Response(serializer.data)


class DoughListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Dodanie ciasta',
        description='Ciasto z recepturą na 1 kg, czasami mieszania i garowania oraz zapasem na straty.',
        request=DoughSerializer,
        responses={201: DoughSerializer, 400: FORM_ERROR, 403: FORBIDDEN},
    )
    def post(self, request):
        if denied := _only_admin(request):
            return denied
        serializer = DoughSerializer(data=request.data)
        if not serializer.is_valid():
            return _invalid(serializer)
        with transaction.atomic():
            dough = serializer.save()
            production_audit.dough_saved(request, dough, before={})
        return Response(DoughSerializer(_dough_queryset().get(pk=dough.pk)).data, status=http_status.HTTP_201_CREATED)


class DoughDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Zmiana ciasta',
        request=DoughSerializer,
        responses={200: DoughSerializer, 400: FORM_ERROR, 403: FORBIDDEN, 404: NOT_FOUND},
    )
    def patch(self, request, pk):
        if denied := _only_admin(request):
            return denied
        dough = get_object_or_404(Dough.objects.select_related('mixer'), pk=pk)
        before = production_audit.dough_state(dough)
        serializer = DoughSerializer(dough, data=request.data, partial=True)
        if not serializer.is_valid():
            return _invalid(serializer)
        composition_before = serializer.instance_composition()
        with transaction.atomic():
            dough = serializer.save()
            production_audit.dough_saved(request, dough, before)
            if serializer.instance_composition() != composition_before:
                recipes.rebuild_for_dough(dough, request)
        return Response(DoughSerializer(_dough_queryset().get(pk=dough.pk)).data)

    @extend_schema(
        summary='Usunięcie ciasta',
        responses={
            204: OpenApiResponse(description='Usunięto.'),
            403: FORBIDDEN,
            404: NOT_FOUND,
            409: error_response('Ciasto jest używane przez wyroby lub zapisane plany.'),
        },
    )
    def delete(self, request, pk):
        if denied := _only_admin(request):
            return denied
        dough = get_object_or_404(Dough.objects.select_related('mixer'), pk=pk)
        try:
            with transaction.atomic():
                # Wpis powstaje przed usunięciem (potrzebny jest identyfikator), a blokada usunięcia cofa go.
                production_audit.dough_deleted(request, dough, production_audit.dough_state(dough))
                dough.delete()
        except ProtectedError:
            return Response(
                {'error': f'Ciasto „{dough.name}” jest używane przez wyroby lub zapisane plany — '
                          'najpierw przypisz wyrobom inne ciasto.'},
                status=http_status.HTTP_409_CONFLICT,
            )
        return Response(status=http_status.HTTP_204_NO_CONTENT)


class DoughSuggestionsView(APIView):
    """Podpowiedź ciasta dla wyrobu: ranking ciast według zgodności z recepturą wyrobu."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Rekomendacja ciasta dla wyrobu',
        description=(
            'Porównuje recepturę wyrobu ze składem każdego ciasta i zwraca do 3 najlepiej pasujących, '
            'z proponowaną wagą kęsa i dodatkami spoza ciasta. Tylko podpowiedź – niczego nie zapisuje.'
        ),
        responses={200: DoughSuggestionsSerializer, 403: FORBIDDEN, 404: NOT_FOUND},
    )
    def get(self, request, product_id):
        if request.user.role not in PRODUCTION_ROLES:
            return _forbidden()
        product = get_object_or_404(Product, pk=product_id)
        return Response(DoughSuggestionsSerializer(recommend_doughs(product)).data)


class BakeSpecDetailView(APIView):
    """Parametry produkcyjne wyrobu: PUT tworzy lub nadpisuje, DELETE wyłącza wyrób z planowania."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Parametry wypieku wyrobu',
        description='Tworzy albo nadpisuje ciasto, wagę kęsa i parametry pieca dla wyrobu – od tej chwili jest planowany.',
        request=BakeSpecSerializer,
        responses={200: BakeSpecRowSerializer, 400: FORM_ERROR, 403: FORBIDDEN, 404: NOT_FOUND},
    )
    def put(self, request, product_id):
        if denied := _only_admin(request):
            return denied
        product = get_object_or_404(Product, pk=product_id)
        spec = ProductBakeSpec.objects.select_related('dough').filter(product=product).first()
        before = production_audit.bake_spec_state(spec)
        serializer = BakeSpecSerializer(spec, data=request.data)
        if not serializer.is_valid():
            return _invalid(serializer)
        with transaction.atomic():
            first_assignment = spec is None
            spec = serializer.save(product=product)
            production_audit.bake_spec_saved(request, product, before, spec)
            if first_assignment:
                recipes.adopt_dough(product, request)
            else:
                recipes.rebuild_recipe(product, request, reason=' (zmiana parametrów wyrobu)')
        product = Product.objects.select_related('bake_spec__dough').get(pk=product.pk)
        return Response(_bake_spec_row(product))

    @extend_schema(
        summary='Wyłączenie wyrobu z planowania',
        description='Usuwa parametry wypieku – wyrób przestaje trafiać do planu produkcji.',
        responses={204: OpenApiResponse(description='Gotowe.'), 403: FORBIDDEN},
    )
    def delete(self, request, product_id):
        if denied := _only_admin(request):
            return denied
        spec = ProductBakeSpec.objects.select_related('dough', 'product').filter(product_id=product_id).first()
        if spec is not None:
            with transaction.atomic():
                before = production_audit.bake_spec_state(spec)
                product = spec.product
                spec.delete()
                recipes.release_dough(product)
                production_audit.bake_spec_deleted(request, product, before)
        return Response(status=http_status.HTTP_204_NO_CONTENT)
