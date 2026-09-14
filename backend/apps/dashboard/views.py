from datetime import date

from django.db.models import DecimalField, ExpressionWrapper, F, Sum
from django.shortcuts import get_object_or_404
from rest_framework import status as http_status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from clients.models import Route
from orders.models import DailyOrder
from products.models import Ingredient, Recipe
from finance.models import DailyFinancialReport
from users.models import User


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
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role not in ('admin', 'driver'):
            return Response(
                {'error': 'Brak dostępu do modułu logistyki.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        preview_param = request.query_params.get('driver')
        if preview_param and user.role != 'admin':
            return Response(
                {'error': 'Tylko administrator może podglądać widok kierowcy.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        if user.role == 'driver':
            scoped_driver_id = user.user_id
        elif preview_param:
            try:
                scoped_driver_id = int(preview_param)
            except (TypeError, ValueError):
                return Response(
                    {'error': 'Nieprawidłowy identyfikator kierowcy.'},
                    status=http_status.HTTP_400_BAD_REQUEST,
                )
            if not User.objects.filter(user_id=scoped_driver_id, role='driver').exists():
                return Response(
                    {'error': 'Nie znaleziono kierowcy.'},
                    status=http_status.HTTP_404_NOT_FOUND,
                )
        else:
            scoped_driver_id = None

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

        routes_qs = (
            Route.objects
            .filter(is_active=True)
            .select_related('driver')
            .prefetch_related('clients')
            .order_by('route_name')
        )
        if scoped_driver_id is not None:
            routes_qs = routes_qs.filter(driver_id=scoped_driver_id)

        assigned_client_ids = set()
        routes_data = []
        for route in routes_qs:
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

        if scoped_driver_id is None:
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
        else:
            unassigned = []

        drivers = []
        if user.role == 'admin':
            drivers = [
                {'user_id': d.user_id, 'full_name': d.full_name}
                for d in User.objects.filter(role='driver', is_active=True).order_by('full_name')
            ]

        return Response({
            'date': str(today),
            'routes': routes_data,
            'unassigned': unassigned,
            'viewer': {
                'role': user.role,
                'is_preview': user.role == 'admin' and scoped_driver_id is not None,
                'driver_id': scoped_driver_id,
            },
            'drivers': drivers,
        })


class UpdateOrderStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        user = request.user
        order = get_object_or_404(DailyOrder, pk=pk)
        new_status = request.data.get('status')

        if new_status not in dict(DailyOrder.STATUS_CHOICES):
            return Response(
                {'error': 'Nieprawidłowy status.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        if user.role == 'driver' and order.client.route.driver_id != user.user_id:
            return Response(
                {'error': 'Nie masz dostępu do tego zamówienia.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )
        elif user.role not in ('admin', 'driver'):
            return Response(
                {'error': 'Brak dostępu do modułu logistyki.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        order.status = new_status
        order.save(update_fields=['status'])
        return Response({'do_id': order.do_id, 'status': order.status})
