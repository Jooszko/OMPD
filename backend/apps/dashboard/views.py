from datetime import date
from django.db import transaction
from django.utils import timezone
from django.db.models import DecimalField, ExpressionWrapper, F, Prefetch, Sum
from django.shortcuts import get_object_or_404
from rest_framework import status as http_status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from clients.models import Client, Route
from orders.models import DailyOrder
from products.models import Ingredient, Recipe
from finance.models import DailyFinancialReport
from users.models import User
from .services.optimize import optimize_stop_order
from .services.directions_cache import get_cached_route_directions
from .services.routing import RoutingError

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
                'delivered_at': o.delivered_at,
            })
            client_by_id[o.client_id] = o.client

        routes_qs = (
            Route.objects
            .filter(is_active=True)
            .select_related('driver')
            .prefetch_related(
                Prefetch('clients', queryset=Client.objects.filter(is_active=True))
            )
            .order_by('route_name')
        )
        if scoped_driver_id is not None:
            routes_qs = routes_qs.filter(driver_id=scoped_driver_id)

        assigned_client_ids = set()
        routes_data = []
        for route in routes_qs:
            stops = []
            for client in route.clients.all():
                assigned_client_ids.add(client.client_id)
                stops.append({
                    'client_id': client.client_id,
                    'name': client.name,
                    'address': client.address,
                    'phone': client.phone,
                    'latitude': client.latitude,
                    'longitude': client.longitude,
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
                    'phone': client_by_id[client_id].phone,
                    'latitude': client_by_id[client_id].latitude,
                    'longitude': client_by_id[client_id].longitude,
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

DRIVER_ALLOWED_TRANSITIONS = {
    'in_delivery': {'delivered'},
    'delivered': {'in_delivery'},
}

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

        if user.role == 'driver':
            if order.client.route.driver_id != user.user_id:
                return Response(
                    {'error': 'Nie masz dostępu do tego zamówienia.'},
                    status=http_status.HTTP_403_FORBIDDEN,
                )
            if order.order_date != date.today():
                return Response(
                    {'error': 'Kierowca może zmieniać statusy jedynie dla dzisiejszych zamówień.'},
                    status=http_status.HTTP_403_FORBIDDEN,
                )
            if new_status not in DRIVER_ALLOWED_TRANSITIONS.get(order.status, set()):
                return Response(
                    {'error': 'Kierowca może oznaczyć zamówienie w dostawie jako "dostarczone" albo cofnąć to oznaczenie.'},
                    status=http_status.HTTP_403_FORBIDDEN,
                )
        elif user.role not in ('admin', 'driver'):
            return Response(
                {'error': 'Brak dostępu do modułu logistyki.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        if new_status == 'delivered' and order.status != 'delivered':
            order.delivered_at = timezone.now()
        elif new_status != 'delivered':
            order.delivered_at = None

        order.status = new_status
        order.save(update_fields=['status', 'delivered_at', 'updated_at'])
        return Response({'do_id': order.do_id, 'status': order.status, 'delivered_at': order.delivered_at})

class DeliverStopView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user

        if user.role not in ('admin', 'driver'):
            return Response(
                {'error': 'Brak dostępu do modułu logistyki.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        client = get_object_or_404(Client, pk=pk)

        if user.role == 'driver' and client.route.driver_id != user.user_id:
            return Response(
                {'error': 'Nie masz dostępu do tego przystanku.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        with transaction.atomic():
            delivered_ids = list(
                DailyOrder.objects
                .select_for_update()
                .filter(client=client, order_date=date.today(), status='in_delivery')
                .values_list('do_id', flat=True)
            )
            if not delivered_ids:
                return Response(
                    {'error': 'U tego klienta nie ma dziś zamówień w dostawie.'},
                    status=http_status.HTTP_400_BAD_REQUEST,
                )
            now = timezone.now()
            DailyOrder.objects.filter(pk__in=delivered_ids).update(
                status='delivered',
                delivered_at=now,
                updated_at=now,
            )

        return Response({'client_id': client.client_id, 'delivered_ids': delivered_ids, 'delivered_at': now})

class RouteDirectionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        user = request.user

        if user.role not in ('admin', 'driver'):
            return Response(
                {'error': 'Brak dostępu do modułu logistyki.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        route = get_object_or_404(Route, pk=pk, is_active=True)

        if user.role == 'driver' and route.driver_id != user.user_id:
            return Response(
                {'error': 'Nie masz dostępu do tej trasy.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        date_param = request.query_params.get('date')
        if date_param:
            try:
                target_date = date.fromisoformat(date_param)
            except ValueError:
                return Response(
                    {'error': 'Nieprawidłowy format daty (YYYY-MM-DD).'},
                    status=http_status.HTTP_400_BAD_REQUEST,
                )
        else:
            target_date = date.today()

        client_ids_with_orders = set(
            DailyOrder.objects
            .filter(order_date=target_date, client__route=route)
            .exclude(status='cancelled')
            .values_list('client_id', flat=True)
        )

        stops = list(
            route.clients
            .filter(is_active=True, client_id__in=client_ids_with_orders)
            .order_by('name')
        )
        routable = [c for c in stops if c.latitude is not None and c.longitude is not None]
        skipped_stops = [c.name for c in stops if c.latitude is None or c.longitude is None]

        if len(routable) < 2:
            return Response({
                'geometry': None,
                'distance_m': None,
                'duration_s': None,
                'provider': None,
                'skipped_stops': skipped_stops,
                'note': 'Za mało zgeokodowanych przystanków, aby wyznaczyć trasę.',
                'optimized': False,
                'ordered_stops': [],
            })

        coordinates = [(float(c.latitude), float(c.longitude)) for c in routable]

        optimized = False
        if len(coordinates) > 2:
            order = optimize_stop_order(coordinates)
            coordinates = [coordinates[i] for i in order]
            routable = [routable[i] for i in order]
            optimized = True

        try:
            result = get_cached_route_directions(coordinates)
        except RoutingError as exc:
            return Response({'error': str(exc)}, status=http_status.HTTP_502_BAD_GATEWAY)

        return Response({
            'geometry': {'coordinates': result['coordinates']},
            'distance_m': result['distance_m'],
            'duration_s': result['duration_s'],
            'provider': result['provider'],
            'skipped_stops': skipped_stops,
            'note': None,
            'optimized': optimized,
            'ordered_stops': [
                {'client_id': c.client_id, 'name': c.name, 'latitude': c.latitude, 'longitude': c.longitude}
                for c in routable
            ],
        })
