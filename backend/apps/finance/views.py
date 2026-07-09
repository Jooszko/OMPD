from datetime import date as date_cls, timedelta
from decimal import Decimal, InvalidOperation

from django.db.models import Sum, Avg, F, DecimalField, ExpressionWrapper
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import Supplier, SupplierIngredient, Expense, DailyFinancialReport
from .serializers import SupplierSerializer
from products.models import Ingredient, Recipe
from orders.models import DailyOrder

class SupplierListView(APIView):
    def get(self, request):
        suppliers = Supplier.objects.all().prefetch_related('ingredients_catalog__ingredient')
        serializer = SupplierSerializer(suppliers, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        products_data = request.data.pop('products', [])
        serializer = SupplierSerializer(data=request.data)
        
        if serializer.is_valid():
            supplier = serializer.save()
            
            for p in products_data:
                try:
                    ingredient = Ingredient.objects.get(pk=p.get('product_id'))
                    SupplierIngredient.objects.get_or_create(supplier=supplier, ingredient=ingredient)
                except Ingredient.DoesNotExist:
                    continue
                    
            return Response(SupplierSerializer(supplier).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class SupplierDetailView(APIView):
    def put(self, request, pk):
        supplier = get_object_or_404(Supplier, pk=pk)
        
        data = request.data.copy() if hasattr(request.data, 'copy') else request.data
        products_data = data.pop('products', [])
        
        serializer = SupplierSerializer(supplier, data=data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            
            SupplierIngredient.objects.filter(supplier=supplier).delete()
            for p in products_data:
                try:
                    ingredient = Ingredient.objects.get(pk=p.get('product_id'))
                    SupplierIngredient.objects.get_or_create(supplier=supplier, ingredient=ingredient)
                except Ingredient.DoesNotExist:
                    continue
            
            return Response(SupplierSerializer(supplier).data, status=status.HTTP_200_OK)
        
        print("BŁĘDY WALIDACJI:", serializer.errors)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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


def _revenue_for_date(target_date):
    result = (
        DailyOrder.objects
        .filter(order_date=target_date)
        .exclude(status='cancelled')
        .aggregate(total=Sum(
            ExpressionWrapper(F('quantity') * F('price_at_sale'), output_field=DecimalField(max_digits=12, decimal_places=2))
        ))
    )
    return result['total'] or Decimal('0')


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
            product__daily_orders__status__in=['planned', 'in_production', 'in_delivery', 'delivered'],
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
    def get(self, request):
        date_param = request.query_params.get('date')
        try:
            target_date = date_cls.fromisoformat(date_param) if date_param else date_cls.today()
        except ValueError:
            return Response({'error': 'Nieprawidłowy format daty.'}, status=status.HTTP_400_BAD_REQUEST)

        revenue = _revenue_for_date(target_date)
        expenses = _expenses_for_date(target_date)
        return Response({
            'date': str(target_date),
            'revenue': str(revenue),
            'expenses': str(expenses),
            'balance': str(revenue - expenses),
        })


class ExpenseListCreateView(APIView):
    def get(self, request):
        start, end = _parse_date_range(request)
        expenses = Expense.objects.filter(date__gte=start, date__lte=end).order_by('-date')
        return Response([
            {
                'expense_id': e.expense_id,
                'category': e.category,
                'category_label': e.get_category_display(),
                'amount': str(e.amount),
                'description': e.description,
                'date': str(e.date),
            }
            for e in expenses
        ])

    def post(self, request):
        category = request.data.get('category')
        amount = request.data.get('amount')
        description = request.data.get('description', '')
        date_str = request.data.get('date')

        valid_categories = dict(Expense.CATEGORY_CHOICES)
        if category not in valid_categories:
            return Response({'error': 'Nieprawidłowa kategoria kosztu.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            amount_dec = Decimal(str(amount))
            if amount_dec <= 0:
                raise InvalidOperation
        except (InvalidOperation, TypeError):
            return Response({'error': 'Nieprawidłowa kwota.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            expense_date = date_cls.fromisoformat(date_str)
        except (ValueError, TypeError):
            return Response({'error': 'Nieprawidłowa data.'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user if request.user.is_authenticated else None
        expense = Expense.objects.create(
            category=category, amount=amount_dec, description=description,
            date=expense_date, created_by=user,
        )
        return Response({
            'expense_id': expense.expense_id,
            'category': expense.category,
            'category_label': expense.get_category_display(),
            'amount': str(expense.amount),
            'description': expense.description,
            'date': str(expense.date),
        }, status=status.HTTP_201_CREATED)


class CategoryBreakdownView(APIView):
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
    def get(self, request):
        start, end = _parse_date_range(request)
        rows = (
            DailyOrder.objects
            .filter(order_date__gte=start, order_date__lte=end)
            .exclude(status='cancelled')
            .values('client__name', 'order_date')
            .annotate(amount=Sum(
                ExpressionWrapper(F('quantity') * F('price_at_sale'), output_field=DecimalField(max_digits=12, decimal_places=2))
            ))
            .order_by('-order_date')
        )
        return Response([
            {'client_name': r['client__name'], 'amount': str(r['amount']), 'date': str(r['order_date'])}
            for r in rows
        ])


class TopClientsView(APIView):
    def get(self, request):
        start, end = _parse_date_range(request)
        rows = (
            DailyOrder.objects
            .filter(order_date__gte=start, order_date__lte=end)
            .exclude(status='cancelled')
            .values('client__name')
            .annotate(total=Sum(
                ExpressionWrapper(F('quantity') * F('price_at_sale'), output_field=DecimalField(max_digits=12, decimal_places=2))
            ))
            .order_by('-total')[:5]
        )
        return Response([{'client_name': r['client__name'], 'total': str(r['total'])} for r in rows])


class ProfitTrendView(APIView):
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


class FinancialReportListView(APIView):
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
        report, _created = DailyFinancialReport.objects.update_or_create(
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
        return Response(_serialize_report(report), status=status.HTTP_201_CREATED)


class FinancialReportDetailView(APIView):
    def delete(self, request, report_date):
        try:
            parsed_date = date_cls.fromisoformat(report_date)
        except ValueError:
            return Response({'error': 'Nieprawidłowy format daty.'}, status=status.HTTP_400_BAD_REQUEST)
        report = get_object_or_404(DailyFinancialReport, report_date=parsed_date)
        report.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)