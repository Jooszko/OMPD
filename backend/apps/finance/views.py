from datetime import date as date_cls, timedelta
from decimal import Decimal
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from users.models import Notification, User
from users.permissions import AdminOnly
from django.shortcuts import get_object_or_404
from .models import Supplier, SupplierIngredient, Expense, DailyFinancialReport, RecurringExpense
from .serializers import SupplierSerializer
from products.models import Ingredient, IngredientStock
from django.db import transaction
from audit.services import field_changes, record_event, snapshot
from .overview import build_overview
from .profitability import build_profitability, parse_price, price_label
from .statement import PERIOD_KINDS, build_statement, period_bounds
from .closings import build_closings, close_day
from .exports import EXPORTS, csv_response, period_slug
from .expenses import EXPENSE_AUDIT_LABELS, expense_label, expense_state, parse_expense, serialize_expense
from .recurring import (
    RECURRING_AUDIT_LABELS,
    covered_until,
    day_label,
    materialize_due_expenses,
    parse_day_of_month,
    parse_recurring_changes,
    recurring_label,
    recurring_state,
    serialize_recurring,
)
from common.openapi import error_response
from .openapi import (
    STATEMENT_PARAMS, CloseDayInputSerializer, ClosingDaySerializer, ExpenseInputSerializer, ExpenseSerializer,
    ExpenseUpdateSerializer, OverviewSerializer, ProfitabilitySerializer, RecurringExpenseSerializer,
    RecurringListSerializer, RecurringUpdateSerializer, StatementSerializer, range_params,
    PriceInputSerializer, PriceResultSerializer, SupplierInputSerializer,
)

SUPPLIER_AUDIT_LABELS = {
    'name': 'Nazwa',
    'phone': 'Telefon',
    'email': 'E-mail',
    'address': 'Adres',
    'nip': 'NIP',
    'is_active': 'Aktywny',
    '_catalog': 'Asortyment i ceny',
}
REPORT_AUDIT_LABELS = {
    'total_revenue': 'Przychód',
    'total_cogs': 'Koszt surowców',
    'total_operating_expenses': 'Koszty operacyjne',
    'net_profit': 'Zysk netto',
}


def _supplier_state(supplier):
    catalog = sorted(
        (
            f'{item.ingredient.name} ({item.last_price:.2f} zł/{item.ingredient.unit})'
            if item.last_price is not None else item.ingredient.name
        )
        + ('' if item.is_assigned else ' (nieprzypisany)')
        for item in SupplierIngredient.objects.filter(supplier=supplier).select_related('ingredient')
    )
    fields = [field for field in SUPPLIER_AUDIT_LABELS if not field.startswith('_')]
    return {**snapshot(supplier, fields), '_catalog': ', '.join(catalog)}


def _save_supplier_catalog(supplier, products_data):
    for p in products_data:
        try:
            ingredient = Ingredient.objects.get(pk=p.get('product_id'))
            defaults = {}
            if 'last_price' in p:
                defaults['last_price'] = (
                    parse_price(p['last_price'])[0] if p['last_price'] is not None else None
                )
            defaults['is_assigned'] = p.get('is_assigned', True)
            supplier_ingredient, created = SupplierIngredient.objects.get_or_create(
                supplier=supplier, ingredient=ingredient, defaults=defaults,
            )
            if not created:
                update_fields = []
                for field in ('last_price', 'is_assigned'):
                    if field in defaults and getattr(supplier_ingredient, field) != defaults[field]:
                        setattr(supplier_ingredient, field, defaults[field])
                        update_fields.append(field)
                if update_fields:
                    supplier_ingredient.save(update_fields=[*update_fields, 'updated_at'])
        except Ingredient.DoesNotExist:
            continue


def _supplier_catalog_error(products_data, supplier=None):
    if not isinstance(products_data, list):
        return 'Lista surowców dostawcy jest nieprawidłowa.'
    saved_prices = {}
    if supplier:
        saved_prices = dict(
            SupplierIngredient.objects.filter(supplier=supplier).values_list('ingredient_id', 'last_price')
        )
    for item in products_data:
        if not isinstance(item, dict):
            return 'Dane surowca dostawcy są nieprawidłowe.'
        if 'is_assigned' in item and not isinstance(item['is_assigned'], bool):
            return 'Status przypisania surowca jest nieprawidłowy.'
        product_id = item.get('product_id')
        saved_price = saved_prices.get(product_id) if isinstance(product_id, int) else None
        if item.get('is_assigned', True) and (
            (
                'last_price' not in item
                and (saved_price is None or saved_price <= 0)
            )
            or (
                'last_price' in item
                and (item['last_price'] is None or not str(item['last_price']).strip())
            )
        ):
            return 'Każdy przypisany surowiec musi mieć cenę większą od zera.'
        if item.get('last_price') is not None:
            _, error = parse_price(item['last_price'])
            if error:
                return error
    return None

class SupplierListView(APIView):
    permission_classes = [AdminOnly]

    @extend_schema(
        summary='Lista dostawców',
        description='Dostawcy z asortymentem: surowce, ostatnie ceny i czy surowiec jest nadal przypisany.',
        responses={200: SupplierSerializer(many=True)},
    )
    def get(self, request):
        suppliers = Supplier.objects.all().prefetch_related('ingredients_catalog__ingredient')
        serializer = SupplierSerializer(suppliers, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary='Dodanie dostawcy',
        request=SupplierInputSerializer,
        responses={
            201: SupplierSerializer,
            400: OpenApiResponse(description='Błędy walidacji pól albo {"error": …} przy błędnym asortymencie.'),
        },
    )
    def post(self, request):
        products_data = request.data.pop('products', [])
        catalog_error = _supplier_catalog_error(products_data)
        if catalog_error:
            return Response({'error': catalog_error}, status=status.HTTP_400_BAD_REQUEST)
        serializer = SupplierSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            supplier = serializer.save()
            _save_supplier_catalog(supplier, products_data)
            changes = [
                c for c in field_changes({}, _supplier_state(supplier), SUPPLIER_AUDIT_LABELS)
                if c['new'] not in (None, '')
            ]
            record_event(
                request, category='finance', action='supplier.created', obj=supplier,
                description=f'Dodano dostawcę {supplier.name}.', changes=changes,
            )
        return Response(SupplierSerializer(supplier).data, status=status.HTTP_201_CREATED)

class SupplierDetailView(APIView):
    permission_classes = [AdminOnly]

    @extend_schema(
        summary='Zmiana dostawcy i jego asortymentu',
        description='Zmienia tylko przesłane pola. Surowce, których nie ma na przesłanej liście products, zostają odpięte.',
        request=SupplierInputSerializer,
        responses={
            200: SupplierSerializer,
            400: OpenApiResponse(description='Błędy walidacji pól albo {"error": …} przy błędnym asortymencie.'),
            404: OpenApiResponse(description='Nie znaleziono dostawcy.'),
        },
    )
    def put(self, request, pk):
        supplier = get_object_or_404(Supplier, pk=pk)

        data = request.data.copy() if hasattr(request.data, 'copy') else request.data
        products_provided = 'products' in data
        products_data = data.pop('products') if products_provided else None
        if products_provided:
            catalog_error = _supplier_catalog_error(products_data, supplier)
            if catalog_error:
                return Response({'error': catalog_error}, status=status.HTTP_400_BAD_REQUEST)

        serializer = SupplierSerializer(supplier, data=data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            before = _supplier_state(supplier)
            serializer.save()
            if products_provided:
                SupplierIngredient.objects.filter(supplier=supplier).update(is_assigned=False)
                _save_supplier_catalog(supplier, products_data)
            changes = field_changes(before, _supplier_state(supplier), SUPPLIER_AUDIT_LABELS)
            if changes:
                record_event(
                    request, category='finance', action='supplier.updated', obj=supplier,
                    description=f'Zmieniono dane dostawcy {supplier.name}.', changes=changes,
                )
        return Response(SupplierSerializer(supplier).data, status=status.HTTP_200_OK)

class ExpenseListCreateView(APIView):
    permission_classes = [AdminOnly]

    @extend_schema(
        summary='Wydatki z okresu',
        description='Najpierw dopisuje zaległe wydatki cykliczne, potem zwraca wydatki od najnowszych.',
        parameters=range_params(30),
        responses={200: ExpenseSerializer(many=True), 400: error_response('Błędny okres.')},
    )
    def get(self, request):
        period, error = _parse_period(request.query_params)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
        materialize_due_expenses()
        expenses = (
            Expense.objects
            .filter(date__range=period)
            .select_related('created_by')
            .order_by('-date', '-expense_id')
        )
        return Response([serialize_expense(expense) for expense in expenses])

    @extend_schema(
        summary='Dodanie wydatku',
        description='Z repeat_monthly = true tworzy też wydatek cykliczny, który będzie dopisywany co miesiąc.',
        request=ExpenseInputSerializer,
        responses={201: ExpenseSerializer, 400: error_response('Błędna kategoria, kwota, data lub dzień miesiąca.')},
    )
    def post(self, request):
        fields, error = parse_expense(request.data)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
        repeat = request.data.get('repeat_monthly') is True
        if repeat:
            day, error = parse_day_of_month(request.data.get('day_of_month', fields['date'].day))
            if error:
                return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            template = None
            if repeat:
                template = RecurringExpense.objects.create(
                    category=fields['category'], amount=fields['amount'], description=fields['description'],
                    day_of_month=day, last_generated_on=covered_until(day, fields['date']), created_by=request.user,
                )
            expense = Expense.objects.create(**fields, created_by=request.user, recurring=template)
            record_event(
                request, category='finance', action='expense.created', obj=expense,
                object_label=expense_label(expense),
                description=(
                    f'Dodano wydatek „{expense.get_category_display()}”: {expense.amount:.2f} zł '
                    f'z dnia {expense.date:%d.%m.%Y}.'
                ),
            )
            if template:
                record_event(
                    request, category='finance', action='recurring.created', obj=template,
                    object_label=recurring_label(template),
                    description=(
                        f'Ustawiono wydatek cykliczny „{template.get_category_display()}”: {template.amount:.2f} zł, '
                        f'{day_label(template.day_of_month)}.'
                    ),
                )
        return Response(serialize_expense(expense), status=status.HTTP_201_CREATED)

class ExpenseDetailView(APIView):
    permission_classes = [AdminOnly]

    @extend_schema(
        summary='Zmiana wydatku',
        request=ExpenseUpdateSerializer,
        responses={200: ExpenseSerializer, 400: error_response('Błędne dane wydatku.'), 404: OpenApiResponse(description='Nie znaleziono.'),},
    )
    def patch(self, request, pk):
        expense = get_object_or_404(Expense.objects.select_related('created_by'), pk=pk)
        fields, error = parse_expense(request.data, partial=True)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)

        before = expense_state(expense)
        with transaction.atomic():
            for field, value in fields.items():
                setattr(expense, field, value)
            expense.save()
            changes = field_changes(before, expense_state(expense), EXPENSE_AUDIT_LABELS)
            if changes:
                record_event(
                    request, category='finance', action='expense.updated', obj=expense,
                    object_label=expense_label(expense),
                    description=f'Zmieniono wydatek „{expense.get_category_display()}” z dnia {expense.date:%d.%m.%Y}.',
                    changes=changes,
                )
        return Response(serialize_expense(expense))

    @extend_schema(
        summary='Usunięcie wydatku',
        responses={204: OpenApiResponse(description='Usunięto.'), 404: OpenApiResponse(description='Nie znaleziono.'),},
    )
    def delete(self, request, pk):
        expense = get_object_or_404(Expense, pk=pk)
        with transaction.atomic():
            record_event(
                request, category='finance', action='expense.deleted', obj=expense,
                object_label=expense_label(expense),
                description=(
                    f'Usunięto wydatek „{expense.get_category_display()}”: {expense.amount:.2f} zł '
                    f'z dnia {expense.date:%d.%m.%Y}.'
                ),
                changes=field_changes(expense_state(expense), {}, EXPENSE_AUDIT_LABELS),
            )
            expense.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class RecurringExpenseListView(APIView):
    permission_classes = [AdminOnly]

    @extend_schema(
        summary='Wydatki cykliczne',
        description='Szablony wydatków dopisywanych co miesiąc, z najbliższą i poprzednią datą.',
        responses={200: RecurringListSerializer},
    )
    def get(self, request):
        materialize_due_expenses()
        today = date_cls.today()
        templates = RecurringExpense.objects.order_by('-is_active', 'day_of_month', 'recurring_id')
        return Response({
            'monthly_total': str(sum((t.amount for t in templates if t.is_active), Decimal('0.00'))),
            'items': [serialize_recurring(template, today) for template in templates],
        })


class RecurringExpenseDetailView(APIView):
    permission_classes = [AdminOnly]

    @extend_schema(
        summary='Zmiana lub wstrzymanie wydatku cyklicznego',
        description='Zmiana dotyczy kolejnych miesięcy – wydatki dodane wcześniej zostają bez zmian.',
        request=RecurringUpdateSerializer,
        responses={200: RecurringExpenseSerializer, 400: error_response('Błędne dane.'), 404: OpenApiResponse(description='Nie znaleziono.'),},
    )
    def patch(self, request, pk):
        template = get_object_or_404(RecurringExpense, pk=pk)
        fields, error = parse_recurring_changes(request.data)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)

        before = recurring_state(template)
        resumed = fields.get('is_active') is True and not template.is_active
        with transaction.atomic():
            for field, value in fields.items():
                setattr(template, field, value)
            if 'day_of_month' in fields and template.last_generated_on:
                template.last_generated_on = covered_until(template.day_of_month, template.last_generated_on)
            if resumed:
                today = date_cls.today()
                template.last_generated_on = max(template.last_generated_on or today, today)
            template.save()
            changes = field_changes(before, recurring_state(template), RECURRING_AUDIT_LABELS)
            if changes:
                record_event(
                    request, category='finance', action='recurring.updated', obj=template,
                    object_label=recurring_label(template),
                    description=f'Zmieniono wydatek cykliczny „{template.get_category_display()}”.',
                    changes=changes,
                )
        return Response(serialize_recurring(template, date_cls.today()))

    @extend_schema(
        summary='Usunięcie wydatku cyklicznego',
        description='Dodane wcześniej wydatki zostają.',
        responses={204: OpenApiResponse(description='Usunięto.'), 404: OpenApiResponse(description='Nie znaleziono.'),},
    )
    def delete(self, request, pk):
        template = get_object_or_404(RecurringExpense, pk=pk)
        with transaction.atomic():
            record_event(
                request, category='finance', action='recurring.deleted', obj=template,
                object_label=recurring_label(template),
                description=(
                    f'Usunięto wydatek cykliczny „{template.get_category_display()}”. '
                    'Dodane wcześniej wydatki zostają.'
                ),
                changes=field_changes(recurring_state(template), {}, RECURRING_AUDIT_LABELS),
            )
            template.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

MAX_PERIOD_DAYS = 366


def _parse_period(params, default_days=30):
    try:
        end = date_cls.fromisoformat(params['end']) if params.get('end') else date_cls.today()
        start = date_cls.fromisoformat(params['start']) if params.get('start') else end - timedelta(days=default_days - 1)
    except ValueError:
        return None, 'Nieprawidłowy format daty (RRRR-MM-DD).'
    if start > end:
        return None, 'Data początkowa nie może być późniejsza niż końcowa.'
    if (end - start).days >= MAX_PERIOD_DAYS:
        return None, f'Okres może obejmować najwyżej {MAX_PERIOD_DAYS} dni.'
    return (start, end), None


class FinanceOverviewView(APIView):
    permission_classes = [AdminOnly]

    @extend_schema(
        summary='Przegląd finansów',
        description='Sumy okresu z porównaniem do poprzedniego, wynik dzień po dniu, struktura kosztów i najlepsi klienci.',
        parameters=range_params(30),
        responses={200: OverviewSerializer, 400: error_response('Błędny okres.')},
    )
    def get(self, request):
        period, error = _parse_period(request.query_params)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
        materialize_due_expenses()
        return Response(build_overview(*period))

class ProfitabilityView(APIView):
    permission_classes = [AdminOnly]

    @extend_schema(
        summary='Rentowność produktów',
        description='Koszt surowców i marża każdego produktu oraz surowce, którym brakuje ceny u dostawcy.',
        parameters=range_params(30),
        responses={200: ProfitabilitySerializer, 400: error_response('Błędny okres.')},
    )
    def get(self, request):
        period, error = _parse_period(request.query_params)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
        return Response(build_profitability(*period))


class IngredientPriceView(APIView):
    permission_classes = [AdminOnly]

    @extend_schema(
        summary='Zmiana ceny magazynowej surowca',
        description=(
            'Cena służy do liczenia kosztu surowców i rentowności produktów. '
            'Kolejne przyjęcia dostaw przeliczają ją średnią ważoną.'
        ),
        request=PriceInputSerializer,
        responses={
            200: PriceResultSerializer,
            400: error_response('Nieprawidłowa cena.'),
            404: OpenApiResponse(description='Nie znaleziono surowca.'),
        },
    )
    def patch(self, request, pk):
        ingredient = get_object_or_404(Ingredient, pk=pk)
        price, error = parse_price(request.data.get('current_price'))
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)

        unit = ingredient.unit
        with transaction.atomic():
            stock, _ = IngredientStock.objects.select_for_update().get_or_create(ingredient=ingredient)
            before = price_label(stock.current_price, unit)
            stock.current_price = price
            stock.save(update_fields=['current_price', 'updated_at'])
            if before != price_label(price, unit):
                record_event(
                    request, category='finance', action='ingredient.price_changed', obj=ingredient,
                    object_label=ingredient.name,
                    description=f'Zmieniono cenę magazynową surowca „{ingredient.name}”.',
                    changes=[{
                        'field': 'current_price', 'label': 'Cena magazynowa',
                        'old': before, 'new': price_label(price, unit),
                    }],
                )
        return Response({
            'ingredient_id': ingredient.pk,
            'ingredient': ingredient.name,
            'current_price': str(stock.current_price),
        })
def _statement_period(params):
    kind = params.get('period', 'month')
    if kind not in PERIOD_KINDS:
        return None, 'Nieznany rodzaj okresu.'
    try:
        anchor = date_cls.fromisoformat(params['date']) if params.get('date') else date_cls.today()
    except ValueError:
        return None, 'Nieprawidłowy format daty (RRRR-MM-DD).'
    if period_bounds(kind, anchor)[0] > date_cls.today():
        return None, 'Ten okres jeszcze się nie zaczął.'
    return (kind, anchor), None


class StatementView(APIView):
    permission_classes = [AdminOnly]

    @extend_schema(
        summary='Rachunek zysków i strat',
        description='Zestawienie za miesiąc, kwartał albo rok z porównaniem do poprzedniego okresu i trendem.',
        parameters=STATEMENT_PARAMS,
        responses={200: StatementSerializer, 400: error_response('Błędny rodzaj okresu lub data.')},
    )
    def get(self, request):
        period, error = _statement_period(request.query_params)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
        materialize_due_expenses()
        return Response(build_statement(*period))


class FinanceExportView(APIView):
    permission_classes = [AdminOnly]

    @extend_schema(
        summary='Eksport CSV dla księgowej',
        parameters=[
            OpenApiParameter(
                'kind', str, OpenApiParameter.PATH, enum=list(EXPORTS),
                description='statement – rachunek zysków i strat, expenses – wydatki, clients – sprzedaż wg klientów, '
                            'closings – zamknięcia dni.',
            ),
            *STATEMENT_PARAMS,
        ],
        responses={
            (200, 'text/csv'): OpenApiResponse(OpenApiTypes.BINARY, description='Plik CSV (UTF-8, separator ;).'),
            400: error_response('Błędny rodzaj okresu lub data.'),
            404: error_response('Nieznany rodzaj eksportu.'),
        },
    )
    def get(self, request, kind):
        if kind not in EXPORTS:
            return Response({'error': 'Nieznany rodzaj eksportu.'}, status=status.HTTP_404_NOT_FOUND)
        period, error = _statement_period(request.query_params)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
        period_kind, anchor = period
        start, end = period_bounds(period_kind, anchor)
        materialize_due_expenses()
        name, build = EXPORTS[kind]
        header, rows = build(period_kind, anchor, start, min(end, date_cls.today()))
        return csv_response(f'{name}-{period_slug(period_kind, start)}.csv', header, rows)
    
MAX_CLOSING_DAYS = 92


def _report_amounts(report):
    return snapshot(report, REPORT_AUDIT_LABELS)


class ClosingListView(APIView):
    permission_classes = [AdminOnly]

    @extend_schema(
        summary='Zamknięcia dni',
        description='Każdy dzień okresu (najwyżej 92) z wynikiem liczonym na bieżąco i – dla zamkniętych – zapisanym.',
        parameters=range_params(14),
        responses={200: ClosingDaySerializer(many=True), 400: error_response('Błędny okres.')},
    )
    def get(self, request):
        period, error = _parse_period(request.query_params, default_days=14)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
        start, end = period
        if end > date_cls.today():
            return Response({'error': 'Nie można pokazać dni z przyszłości.'}, status=status.HTTP_400_BAD_REQUEST)
        if (end - start).days >= MAX_CLOSING_DAYS:
            return Response(
                {'error': f'Zamknięcia można przeglądać najwyżej za {MAX_CLOSING_DAYS} dni naraz.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        materialize_due_expenses()
        return Response(build_closings(start, end))

    @extend_schema(
        summary='Zamknięcie dnia',
        description='Zapisuje na stałe przychód, koszty i zysk minionego dnia.',
        request=CloseDayInputSerializer,
        responses={
            201: ClosingDaySerializer,
            400: error_response('Błędna data, dzień z przyszłości albo już zamknięty.'),
        },
    )
    def post(self, request):
        try:
            day = date_cls.fromisoformat(str(request.data.get('date')))
        except ValueError:
            return Response({'error': 'Nieprawidłowa data.'}, status=status.HTTP_400_BAD_REQUEST)
        if day > date_cls.today():
            return Response({'error': 'Nie można zamknąć dnia, który jeszcze nie minął.'}, status=status.HTTP_400_BAD_REQUEST)
        if DailyFinancialReport.objects.filter(report_date=day).exists():
            return Response({'error': 'Ten dzień jest już zamknięty.'}, status=status.HTTP_400_BAD_REQUEST)

        materialize_due_expenses()
        with transaction.atomic():
            report = close_day(day, request.user)
            record_event(
                request, category='finance', action='report.closed', obj=report,
                object_label=f'Dzień {day:%d.%m.%Y}',
                description=f'Zamknięto dzień {day:%d.%m.%Y} – kwoty zapisano na stałe.',
                changes=field_changes({}, _report_amounts(report), REPORT_AUDIT_LABELS),
            )
            Notification.objects.bulk_create([
                Notification(
                    user=admin,
                    sender=request.user,
                    title='Zamknięto dzień',
                    message=f'Zamknięto dzień {day:%d.%m.%Y}.',
                )
                for admin in User.objects.filter(role='admin')
            ])
        return Response(build_closings(day, day)[0], status=status.HTTP_201_CREATED)


class ClosingDetailView(APIView):
    permission_classes = [AdminOnly]

    @extend_schema(
        summary='Ponowne otwarcie dnia',
        description='Usuwa zapisane kwoty – dzień znowu liczy się na bieżąco.',
        parameters=[OpenApiParameter('day', OpenApiTypes.DATE, OpenApiParameter.PATH)],
        responses={
            204: OpenApiResponse(description='Otwarto ponownie.'),
            400: error_response('Błędna data.'),
            404: OpenApiResponse(description='Ten dzień nie był zamknięty.'),
        },
    )
    def delete(self, request, day):
        try:
            parsed_day = date_cls.fromisoformat(day)
        except ValueError:
            return Response({'error': 'Nieprawidłowa data.'}, status=status.HTTP_400_BAD_REQUEST)
        report = get_object_or_404(DailyFinancialReport, report_date=parsed_day)
        with transaction.atomic():
            record_event(
                request, category='finance', action='report.reopened', obj=report,
                object_label=f'Dzień {parsed_day:%d.%m.%Y}',
                description=(
                    f'Ponownie otwarto dzień {parsed_day:%d.%m.%Y}. Kwoty z zamknięcia zostają w tym wpisie, '
                    'a dzień znowu liczy się na bieżąco.'
                ),
                changes=field_changes(_report_amounts(report), {}, REPORT_AUDIT_LABELS),
            )
            report.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)