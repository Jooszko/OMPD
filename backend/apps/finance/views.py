from datetime import date as date_cls, timedelta
from decimal import Decimal
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from users.permissions import AdminOnly
from django.shortcuts import get_object_or_404
from .models import Supplier, SupplierIngredient, Expense, DailyFinancialReport, RecurringExpense
from .serializers import SupplierSerializer
from products.models import Ingredient
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

SUPPLIER_AUDIT_LABELS = {
    'name': 'Nazwa',
    'phone': 'Telefon',
    'email': 'E-mail',
    'address': 'Adres',
    'nip': 'NIP',
    'is_active': 'Aktywny',
    '_catalog': 'Asortyment',
}
REPORT_AUDIT_LABELS = {
    'total_revenue': 'Przychód',
    'total_cogs': 'Koszt surowców',
    'total_operating_expenses': 'Koszty operacyjne',
    'net_profit': 'Zysk netto',
}


def _supplier_state(supplier):
    catalog = sorted(
        SupplierIngredient.objects.filter(supplier=supplier).values_list('ingredient__name', flat=True)
    )
    fields = [field for field in SUPPLIER_AUDIT_LABELS if not field.startswith('_')]
    return {**snapshot(supplier, fields), '_catalog': ', '.join(catalog)}


def _save_supplier_catalog(supplier, products_data):
    for p in products_data:
        try:
            ingredient = Ingredient.objects.get(pk=p.get('product_id'))
            SupplierIngredient.objects.get_or_create(supplier=supplier, ingredient=ingredient)
        except Ingredient.DoesNotExist:
            continue

class SupplierListView(APIView):
    permission_classes = [AdminOnly]
    def get(self, request):
        suppliers = Supplier.objects.all().prefetch_related('ingredients_catalog__ingredient')
        serializer = SupplierSerializer(suppliers, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        products_data = request.data.pop('products', [])
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
    def put(self, request, pk):
        supplier = get_object_or_404(Supplier, pk=pk)

        data = request.data.copy() if hasattr(request.data, 'copy') else request.data
        products_data = data.pop('products', [])

        serializer = SupplierSerializer(supplier, data=data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            before = _supplier_state(supplier)
            serializer.save()
            kept = [p.get('product_id') for p in products_data if str(p.get('product_id')).isdigit()]
            SupplierIngredient.objects.filter(supplier=supplier).exclude(ingredient_id__in=kept).delete()
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
    """(start, end) from ?start=&end=, by default the last `default_days` days ending today."""
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

    def get(self, request):
        period, error = _parse_period(request.query_params)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
        materialize_due_expenses()
        return Response(build_overview(*period))

class ProfitabilityView(APIView):
    permission_classes = [AdminOnly]

    def get(self, request):
        period, error = _parse_period(request.query_params)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
        return Response(build_profitability(*period))


class SupplierIngredientPriceView(APIView):
    permission_classes = [AdminOnly]

    def patch(self, request, pk):
        item = get_object_or_404(SupplierIngredient.objects.select_related('supplier', 'ingredient'), pk=pk)
        price, error = parse_price(request.data.get('last_price'))
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)

        unit = item.ingredient.unit
        before = price_label(item.last_price, unit)
        with transaction.atomic():
            item.last_price = price
            item.save(update_fields=['last_price', 'updated_at'])
            if before != price_label(price, unit):
                record_event(
                    request, category='finance', action='supplier.price_changed', obj=item.supplier,
                    object_label=f'{item.supplier.name} – {item.ingredient.name}',
                    description=f'Zmieniono cenę surowca „{item.ingredient.name}” u dostawcy {item.supplier.name}.',
                    changes=[{'field': 'last_price', 'label': 'Cena', 'old': before, 'new': price_label(price, unit)}],
                )
        return Response({
            'supplier_ingredient_id': item.pk,
            'supplier': item.supplier.name,
            'ingredient': item.ingredient.name,
            'last_price': str(item.last_price),
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

    def get(self, request):
        period, error = _statement_period(request.query_params)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
        materialize_due_expenses()
        return Response(build_statement(*period))


class FinanceExportView(APIView):
    permission_classes = [AdminOnly]

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
        return Response(build_closings(day, day)[0], status=status.HTTP_201_CREATED)


class ClosingDetailView(APIView):
    permission_classes = [AdminOnly]

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