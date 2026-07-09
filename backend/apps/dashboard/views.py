from datetime import date

from django.db.models import DecimalField, ExpressionWrapper, F, Sum
from django.shortcuts import get_object_or_404
from rest_framework import status as http_status
from rest_framework.response import Response
from rest_framework.views import APIView

from clients.models import Route
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


class LogisticsView(APIView):
    def get(self, request):
        today = date.today()

        orders_today = (
            DailyOrder.objects
            .filter(order_date=today)
            .exclude(status='cancelled')
            .select_related('client', 'product')
            .order_by('client__name')
        )

        orders_by_client = {}
        client_by_id = {}
        for o in orders_today:
            orders_by_client.setdefault(o.client_id, []).append({
                'do_id': o.do_id,
                'product_name': o.product.name,
                'quantity': o.quantity,
                'status': o.status,
            })
            client_by_id[o.client_id] = o.client

        routes = (
            Route.objects
            .filter(is_active=True)
            .select_related('driver')
            .prefetch_related('clients')
            .order_by('route_name')
        )

        assigned_client_ids = set()
        routes_data = []
        for route in routes:
            stops = []
            for client in route.clients.filter(is_active=True):
                assigned_client_ids.add(client.client_id)
                stops.append({
                    'client_id': client.client_id,
                    'name': client.name,
                    'address': client.address,
                    'orders': orders_by_client.get(client.client_id, []),
                })

            stops.sort(key=lambda s: (len(s['orders']) == 0, s['name']))

            routes_data.append({
                'route_id': route.route_id,
                'route_name': route.route_name,
                'driver': {
                    'user_id': route.driver.user_id,
                    'full_name': route.driver.full_name,
                } if route.driver else None,
                'stops': stops,
            })

        unassigned = [
            {
                'client_id': client_id,
                'name': client_by_id[client_id].name,
                'address': client_by_id[client_id].address,
                'orders': orders,
            }
            for client_id, orders in orders_by_client.items()
            if client_id not in assigned_client_ids
        ]

        return Response({
            'date': str(today),
            'routes': routes_data,
            'unassigned': unassigned,
        })


class UpdateOrderStatusView(APIView):
    def patch(self, request, pk):
        order = get_object_or_404(DailyOrder, pk=pk)
        new_status = request.data.get('status')

        if new_status not in dict(DailyOrder.STATUS_CHOICES):
            return Response(
                {'error': 'Nieprawidłowy status.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        order.status = new_status
        order.save(update_fields=['status'])
        return Response({'do_id': order.do_id, 'status': order.status})
