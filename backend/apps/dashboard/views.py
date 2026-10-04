from datetime import date, timedelta
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
from users.models import Notification, User
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

        orders_for_day = (
            DailyOrder.objects
            .filter(order_date=target_date)
            .exclude(status='cancelled')
            .select_related('client', 'product')
            .order_by('client__name')
        )

        orders_by_client = {}
        client_by_id = {}
        for o in orders_for_day:
            orders_by_client.setdefault(o.client_id, []).append({
                'do_id': o.do_id,
                'product_name': o.product.name,
                'quantity': o.quantity,
                'status': o.status,
                'delivered_at': o.delivered_at,
                'failure_reason': o.failure_reason,
                'failure_note': o.failure_note,
                'failed_at': o.failed_at,
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
            'date': str(target_date),
            'today': str(date.today()),
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

DRIVER_UNDO_WINDOW = timedelta(minutes=10)

def _within_driver_undo_window(moment):
    return moment is not None and timezone.now() - moment <= DRIVER_UNDO_WINDOW

MAX_FAILURE_NOTE_LENGTH = 500


def _notify_admins(sender, title, message):
    admins = User.objects.filter(role='admin', is_active=True).exclude(pk=sender.pk)
    Notification.objects.bulk_create([
        Notification(user=admin, sender=sender, title=title, message=message)
        for admin in admins
    ])

def _format_order_items(orders):
    return ', '.join(f'{o.product.name} x{o.quantity}' for o in orders)


def _notify_admins_about_failure(sender, client, orders, reason, note):
    reason_label = dict(DailyOrder.FAILURE_REASON_CHOICES)[reason]
    message = (
        f'{sender.full_name} zgłosił problem z dostawą do klienta {client.name} ({client.address}).\n'
        f'Powód: {reason_label}\n'
        f'Pozycje: {_format_order_items(orders)}'
    )
    if note:
        message += f'\nNotatka: {note}'
    _notify_admins(sender, f'Problem z dostawą: {client.name}', message)

def _report_failure(request, client, orders_qs):
    reason = request.data.get('reason')
    note = str(request.data.get('note') or '').strip()

    if not isinstance(reason, str) or reason not in dict(DailyOrder.FAILURE_REASON_CHOICES):
        return Response(
            {'error': 'Wybierz powód problemu z dostawą.'},
            status=http_status.HTTP_400_BAD_REQUEST,
        )
    if reason == 'other' and not note:
        return Response(
            {'error': 'Przy powodzie „Inny powód” opisz problem w notatce.'},
            status=http_status.HTTP_400_BAD_REQUEST,
        )
    if len(note) > MAX_FAILURE_NOTE_LENGTH:
        return Response(
            {'error': f'Notatka może mieć najwyżej {MAX_FAILURE_NOTE_LENGTH} znaków.'},
            status=http_status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        orders = list(
            orders_qs
            .select_for_update(of=('self',))
            .select_related('product')
            .filter(order_date=date.today(), status='in_delivery')
        )
        if not orders:
            return Response(
                {'error': 'Brak zamówień w dostawie, dla których można zgłosić problem.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        failed_ids = [o.do_id for o in orders]
        now = timezone.now()
        DailyOrder.objects.filter(pk__in=failed_ids).update(
            status='failed',
            failure_reason=reason,
            failure_note=note,
            failed_at=now,
            updated_at=now,
        )
        _notify_admins_about_failure(request.user, client, orders, reason, note)

    return Response({
        'client_id': client.client_id,
        'failed_ids': failed_ids,
        'failure_reason': reason,
        'failure_note': note,
        'failed_at': now,
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

        if new_status == 'failed':
            return Response(
                {'error': 'Aby oznaczyć nieudaną dostawę, użyj opcji „Zgłoś problem” i podaj powód.'},
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
            if order.status == 'delivered' and not _within_driver_undo_window(order.delivered_at):
                return Response(
                    {'error': 'Czas na cofnięcie dostawy minął. Skontaktuj się z biurem.'},
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

        order.failure_reason = ''
        order.failure_note = ''
        order.failed_at = None
        order.status = new_status
        order.save(update_fields=[
            'status', 'delivered_at', 'failure_reason', 'failure_note', 'failed_at', 'updated_at',
        ])
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

class ReportStopProblemView(APIView):
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

        return _report_failure(request, client, DailyOrder.objects.filter(client=client))


class ReportOrderProblemView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user

        if user.role not in ('admin', 'driver'):
            return Response(
                {'error': 'Brak dostępu do modułu logistyki.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        order = get_object_or_404(DailyOrder.objects.select_related('client__route'), pk=pk)

        if user.role == 'driver' and order.client.route.driver_id != user.user_id:
            return Response(
                {'error': 'Nie masz dostępu do tego zamówienia.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        return _report_failure(request, order.client, DailyOrder.objects.filter(pk=order.pk))

class WithdrawProblemView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        if user.role not in ('admin', 'driver'):
            return Response(
                {'error': 'Brak dostępu do modułu logistyki.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        order_ids = request.data.get('order_ids')
        if (
            not isinstance(order_ids, list)
            or not order_ids
            or not all(isinstance(i, int) for i in order_ids)
        ):
            return Response(
                {'error': 'Podaj listę zamówień, dla których chcesz wycofać zgłoszenie.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        requested_ids = set(order_ids)

        with transaction.atomic():
            orders = list(
                DailyOrder.objects
                .select_for_update(of=('self',))
                .select_related('client__route', 'product')
                .filter(pk__in=requested_ids, order_date=date.today(), status='failed')
            )

            if user.role == 'driver' and any(o.client.route.driver_id != user.user_id for o in orders):
                return Response(
                    {'error': 'Nie masz dostępu do tych zamówień.'},
                    status=http_status.HTTP_403_FORBIDDEN,
                )
            if {o.do_id for o in orders} != requested_ids:
                return Response(
                    {'error': 'Części zgłoszeń nie można już wycofać. Odśwież dane.'},
                    status=http_status.HTTP_400_BAD_REQUEST,
                )
            if user.role == 'driver' and not all(_within_driver_undo_window(o.failed_at) for o in orders):
                return Response(
                    {'error': 'Czas na wycofanie zgłoszenia minął. Skontaktuj się z biurem.'},
                    status=http_status.HTTP_403_FORBIDDEN,
                )

            DailyOrder.objects.filter(pk__in=requested_ids).update(
                status='in_delivery',
                failure_reason='',
                failure_note='',
                failed_at=None,
                updated_at=timezone.now(),
            )

            orders_by_client = {}
            for order in orders:
                orders_by_client.setdefault(order.client, []).append(order)
            for client, client_orders in orders_by_client.items():
                _notify_admins(
                    user,
                    f'Zgłoszenie wycofane: {client.name}',
                    f'{user.full_name} wycofał zgłoszenie problemu z dostawą do klienta '
                    f'{client.name} ({client.address}).\n'
                    f'Pozycje: {_format_order_items(client_orders)}\n'
                    f'Zamówienia wróciły do statusu „W dostawie”.',
                )

        return Response({'reverted_ids': sorted(requested_ids)})

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
