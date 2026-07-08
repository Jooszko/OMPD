from datetime import date

from django.db.models import DecimalField, ExpressionWrapper, F, Sum
from rest_framework.response import Response
from rest_framework.views import APIView

from orders.models import DailyOrder
from products.models import Ingredient, Recipe
from finance.models import DailyFinancialReport


class DashboardView(APIView):
    def get(self, request):
        today = date.today()
        today_orders_qs = DailyOrder.objects.filter(order_date=today).select_related('client', 'product')

        today_orders = [
            {
                'client_name': o.client.name,
                'product_name': o.product.name,
                'quantity': o.quantity,
                'price_at_sale': str(o.price_at_sale),
                'status': o.status,
            }
            for o in today_orders_qs
        ]

        total_items = today_orders_qs.aggregate(total=Sum('quantity'))['total'] or 0

        ingredients_used = list(
            Recipe.objects
            .filter(product__daily_orders__order_date=today)
            .values('ingredient__name', 'ingredient__unit')
            .annotate(
                total_amount=Sum(
                    ExpressionWrapper(
                        F('amount') * F('product__daily_orders__quantity'),
                        output_field=DecimalField(max_digits=10, decimal_places=3),
                    )
                )
            )
            .order_by('ingredient__name')
            .values('ingredient__name', 'ingredient__unit', 'total_amount')
        )

        revenue_per_client = list(
            DailyOrder.objects
            .filter(order_date=today)
            .values('client__name')
            .annotate(
                total_revenue=Sum(
                    ExpressionWrapper(
                        F('quantity') * F('price_at_sale'),
                        output_field=DecimalField(max_digits=12, decimal_places=2),
                    )
                )
            )
            .order_by('client__name')
        )

        warehouse_stock = list(
            Ingredient.objects
            .values('name', 'unit', 'stock__current_stock', 'stock__min_stock_level')
            .order_by('name')
        )

        report = DailyFinancialReport.objects.filter(report_date=today).first()
        financial_summary = None
        if report:
            financial_summary = {
                'total_revenue': str(report.total_revenue),
                'total_cogs': str(report.total_cogs),
                'total_operating_expenses': str(report.total_operating_expenses),
                'net_profit': str(report.net_profit),
                'is_finalized': report.is_finalized,
            }

        return Response({
            'today_orders': today_orders,
            'total_items_for_shipment': total_items,
            'ingredients_used_today': [
                {
                    'name': row['ingredient__name'],
                    'unit': row['ingredient__unit'],
                    'total_amount': str(row['total_amount']),
                }
                for row in ingredients_used
            ],
            'revenue_per_client': [
                {
                    'client_name': row['client__name'],
                    'total_revenue': str(row['total_revenue']),
                }
                for row in revenue_per_client
            ],
            'warehouse_stock': [
                {
                    'name': row['name'],
                    'unit': row['unit'],
                    'current_stock': str(row['stock__current_stock']),
                    'min_stock_level': str(row['stock__min_stock_level']),
                }
                for row in warehouse_stock
            ],
            'financial_summary': financial_summary,
        })
