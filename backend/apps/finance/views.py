from datetime import date as date_cls, timedelta
from decimal import Decimal

from django.db.models import Sum, Avg, F, DecimalField, ExpressionWrapper
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from users.permissions import AdminOnly
from django.shortcuts import get_object_or_404
from .models import Supplier, SupplierIngredient, Expense, DailyFinancialReport, RecurringExpense
from .serializers import SupplierSerializer
from products.models import Ingredient, Recipe
from orders.models import DailyOrder, ProductReturn
from django.db import transaction
from audit.services import field_changes, record_event, snapshot
from .overview import build_overview
from .profitability import build_profitability, parse_price, price_label
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


def _parse_date_range(request, default_days=30):
    today = date_cls.today()
    start_param = request.query_params.get('start')
    end_param = request.query_params.get('end')
    try:
        start = date_cls.fromisoformat(start_param) if start_param else today - timedelta(days=default_days)
        end = date_cls.fromisoformat(end_param) if end_param else today
    except ValueError:
        start, end = today - timedelta(days=default_days), today
    return start, end


def _sales_for_date(target_date):
    result = (
        DailyOrder.objects
        .filter(order_date=target_date)
        .exclude(status__in=DailyOrder.NON_REVENUE_STATUSES)
        .aggregate(total=Sum(
            ExpressionWrapper(F('quantity') * F('price_at_sale'), output_field=DecimalField(max_digits=12, decimal_places=2))
        ))
    )
    return result['total'] or Decimal('0')


def _returns_for_date(target_date):
    result = ProductReturn.objects.filter(return_date=target_date).aggregate(total=Sum(
        ExpressionWrapper(F('quantity') * F('unit_price'), output_field=DecimalField(max_digits=12, decimal_places=2))
    ))
    return result['total'] or Decimal('0')


def _revenue_for_date(target_date):
    return _sales_for_date(target_date) - _returns_for_date(target_date)


def _expenses_for_date(target_date):
    return Expense.objects.filter(date=target_date).aggregate(total=Sum('amount'))['total'] or Decimal('0')


def _cogs_for_date(target_date):
    ingredient_prices = dict(
        SupplierIngredient.objects
        .exclude(last_price__isnull=True)
        .values('ingredient_id')
        .annotate(avg_price=Avg('last_price'))
        .values_list('ingredient_id', 'avg_price')
    )

    usage = (
        Recipe.objects
        .filter(
            product__daily_orders__order_date=target_date,
            product__daily_orders__status__in=['planned', 'in_production', 'in_delivery', 'delivered', 'failed'],
        )
        .values('ingredient_id')
        .annotate(
            total_amount=Sum(
                ExpressionWrapper(
                    F('amount') * F('product__daily_orders__quantity'),
                    output_field=DecimalField(max_digits=10, decimal_places=3),
                )
            )
        )
    )

    cogs = Decimal('0')
    for row in usage:
        price = ingredient_prices.get(row['ingredient_id']) or Decimal('0')
        cogs += row['total_amount'] * price
    return cogs


def _serialize_report(report):
    return {
        'report_date': str(report.report_date),
        'total_revenue': str(report.total_revenue),
        'total_cogs': str(report.total_cogs),
        'total_operating_expenses': str(report.total_operating_expenses),
        'net_profit': str(report.net_profit),
        'is_finalized': report.is_finalized,
    }


class DailySummaryView(APIView):
    permission_classes = [AdminOnly]
    def get(self, request):
        date_param = request.query_params.get('date')
        try:
            target_date = date_cls.fromisoformat(date_param) if date_param else date_cls.today()
        except ValueError:
            return Response({'error': 'Nieprawidłowy format daty.'}, status=status.HTTP_400_BAD_REQUEST)

        sales = _sales_for_date(target_date)
        returns = _returns_for_date(target_date)
        revenue = sales - returns
        expenses = _expenses_for_date(target_date)
        return Response({
            'date': str(target_date),
            'sales': str(sales),
            'returns': str(returns),
            'revenue': str(revenue),
            'expenses': str(expenses),
            'balance': str(revenue - expenses),
        })


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

class CategoryBreakdownView(APIView):
    permission_classes = [AdminOnly]
    def get(self, request):
        start, end = _parse_date_range(request)
        rows = (
            Expense.objects.filter(date__gte=start, date__lte=end)
            .values('category')
            .annotate(total=Sum('amount'))
            .order_by('-total')
        )
        labels = dict(Expense.CATEGORY_CHOICES)
        return Response([
            {'category': r['category'], 'category_label': labels.get(r['category'], r['category']), 'total': str(r['total'])}
            for r in rows
        ])


class PeriodIncomesView(APIView):
    permission_classes = [AdminOnly]
    def get(self, request):
        start, end = _parse_date_range(request)
        sales = (
            DailyOrder.objects
            .filter(order_date__gte=start, order_date__lte=end)
            .exclude(status__in=DailyOrder.NON_REVENUE_STATUSES)
            .values('client__name', 'order_date')
            .annotate(amount=Sum(
                ExpressionWrapper(F('quantity') * F('price_at_sale'), output_field=DecimalField(max_digits=12, decimal_places=2))
            ))
        )
        returns = (
            ProductReturn.objects
            .filter(return_date__gte=start, return_date__lte=end)
            .values('client__name', 'return_date')
            .annotate(amount=Sum(
                ExpressionWrapper(F('quantity') * F('unit_price'), output_field=DecimalField(max_digits=12, decimal_places=2))
            ))
        )
        rows = [
            {'client_name': r['client__name'], 'amount': str(r['amount']), 'date': str(r['order_date']), 'kind': 'sale'}
            for r in sales
        ] + [
            {'client_name': r['client__name'], 'amount': str(-r['amount']), 'date': str(r['return_date']), 'kind': 'return'}
            for r in returns
        ]
        rows.sort(key=lambda row: row['date'], reverse=True)
        return Response(rows)


class TopClientsView(APIView):
    permission_classes = [AdminOnly]
    def get(self, request):
        start, end = _parse_date_range(request)
        sales = (
            DailyOrder.objects
            .filter(order_date__gte=start, order_date__lte=end)
            .exclude(status__in=DailyOrder.NON_REVENUE_STATUSES)
            .values('client__name')
            .annotate(total=Sum(
                ExpressionWrapper(F('quantity') * F('price_at_sale'), output_field=DecimalField(max_digits=12, decimal_places=2))
            ))
            .values_list('client__name', 'total')
        )
        returns = dict(
            ProductReturn.objects
            .filter(return_date__gte=start, return_date__lte=end)
            .values('client__name')
            .annotate(total=Sum(
                ExpressionWrapper(F('quantity') * F('unit_price'), output_field=DecimalField(max_digits=12, decimal_places=2))
            ))
            .values_list('client__name', 'total')
        )
        totals = [(name, total - returns.get(name, Decimal('0'))) for name, total in sales]
        totals.sort(key=lambda row: row[1], reverse=True)
        return Response([{'client_name': name, 'total': str(total)} for name, total in totals[:5]])


class ProfitTrendView(APIView):
    permission_classes = [AdminOnly]
    def get(self, request):
        start, end = _parse_date_range(request, default_days=6)
        trend = []
        current = start
        while current <= end:
            revenue = _revenue_for_date(current)
            expenses = _expenses_for_date(current)
            trend.append({'date': str(current), 'net_profit': str(revenue - expenses)})
            current += timedelta(days=1)
        return Response(trend)

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

class FinancialReportListView(APIView):
    permission_classes = [AdminOnly]
    def get(self, request):
        reports = DailyFinancialReport.objects.all().order_by('-report_date')
        return Response([_serialize_report(r) for r in reports])

    def post(self, request):
        today = date_cls.today()
        revenue = _revenue_for_date(today)
        expenses = _expenses_for_date(today)
        cogs = _cogs_for_date(today)
        net_profit = revenue - expenses - cogs

        user = request.user if request.user.is_authenticated else None
        with transaction.atomic():
            existing = DailyFinancialReport.objects.filter(report_date=today).first()
            before = snapshot(existing, REPORT_AUDIT_LABELS) if existing else {}
            report, created = DailyFinancialReport.objects.update_or_create(
                report_date=today,
                defaults={
                    'total_revenue': revenue,
                    'total_cogs': cogs,
                    'total_operating_expenses': expenses,
                    'net_profit': net_profit,
                    'is_finalized': True,
                    'generated_by': user,
                },
            )
            report.refresh_from_db()
            record_event(
                request, category='finance',
                action='report.generated' if created else 'report.regenerated',
                obj=report, object_label=f'Raport {today:%d.%m.%Y}',
                description=(
                    f'{"Wygenerowano" if created else "Ponownie wygenerowano"} raport finansowy '
                    f'z dnia {today:%d.%m.%Y}.'
                ),
                changes=field_changes(before, snapshot(report, REPORT_AUDIT_LABELS), REPORT_AUDIT_LABELS),
            )
        return Response(_serialize_report(report), status=status.HTTP_201_CREATED)


class FinancialReportDetailView(APIView):
    permission_classes = [AdminOnly]
    def delete(self, request, report_date):
        try:
            parsed_date = date_cls.fromisoformat(report_date)
        except ValueError:
            return Response({'error': 'Nieprawidłowy format daty.'}, status=status.HTTP_400_BAD_REQUEST)
        report = get_object_or_404(DailyFinancialReport, report_date=parsed_date)
        with transaction.atomic():
            record_event(
                request, category='finance', action='report.deleted', obj=report,
                object_label=f'Raport {parsed_date:%d.%m.%Y}',
                description=f'Usunięto raport finansowy z dnia {parsed_date:%d.%m.%Y}.',
                changes=field_changes(snapshot(report, REPORT_AUDIT_LABELS), {}, REPORT_AUDIT_LABELS),
            )
            report.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)