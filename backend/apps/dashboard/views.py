import uuid
from functools import wraps
import mimetypes
from datetime import date, datetime, timedelta
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.db.models import Case, F, IntegerField, Prefetch, Q, When
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.http import FileResponse
from rest_framework import status as http_status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from PIL import Image, UnidentifiedImageError
from rest_framework.parsers import MultiPartParser

from clients.models import Client, Route
from orders.models import DailyOrder, DeliveryProof, ProductReturn
from products.models import Ingredient
from users.models import Notification, User
from .services.optimize import optimize_stop_order
from .services.directions_cache import get_cached_route_directions
from .services.routing import RoutingError
from .services.delivery_stats import build_delivery_stats
from .services.returns import last_delivery_items, returns_overview
from .services.home import build_home
from .models import ClientAction
from users.permissions import AdminOrBaker
from audit.services import field_changes, record_event

class DashboardView(APIView):
    permission_classes = [AdminOrBaker]

    def get(self, request):
        warehouse_stock = (
            Ingredient.objects
            .values('name', 'unit', 'stock__current_stock', 'stock__min_stock_level')
            .order_by('name')
        )
        return Response({
            'warehouse_stock': [
                {
                    'name': row['name'],
                    'unit': row['unit'],
                    'current_stock': str(row['stock__current_stock']),
                    'min_stock_level': str(row['stock__min_stock_level']),
                }
                for row in warehouse_stock
            ],
        })


class HomeView(APIView):
    permission_classes = [AdminOrBaker]

    def get(self, request):
        return Response(build_home(request.user, timezone.localdate()))


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

        orders_for_day = _with_effective_assignment(
            DailyOrder.objects
            .filter(order_date=target_date)
            .exclude(status='cancelled')
            .select_related('client', 'product')
            .order_by('client__name')
        )
        if scoped_driver_id is not None:
            orders_for_day = orders_for_day.filter(effective_driver_id=scoped_driver_id)

        orders_by_stop = {}
        client_by_id = {}
        for o in orders_for_day:
            orders_by_stop.setdefault((o.effective_route_id, o.client_id), []).append({
                'do_id': o.do_id,
                'product_name': o.product.name,
                'quantity': o.quantity,
                'status': o.status,
                'delivered_at': o.delivered_at,
                'delivery_note': o.delivery_note,
                'failure_reason': o.failure_reason,
                'failure_note': o.failure_note,
                'failed_at': o.failed_at,
            })
            client_by_id[o.client_id] = o.client

        proofs_by_client = {}
        for proof in DeliveryProof.objects.filter(order_date=target_date).order_by('kind'):
            proofs_by_client.setdefault(proof.client_id, []).append(_proof_payload(proof))

        returns_by_client = returns_overview({client_id for _, client_id in orders_by_stop}, target_date)
        route_ids_with_orders = {route_id for route_id, _ in orders_by_stop}

        routes_qs = (
            Route.objects
            .filter(Q(is_active=True) | Q(route_id__in=route_ids_with_orders))
            .select_related('driver')
            .prefetch_related(
                Prefetch('clients', queryset=Client.objects.filter(is_active=True))
            )
            .order_by('route_name')
        )
        if scoped_driver_id is not None:
            routes_qs = routes_qs.filter(Q(driver_id=scoped_driver_id) | Q(route_id__in=route_ids_with_orders))

        shown_stops = set()
        routes_data = []
        for route in routes_qs:
            stop_clients = {}
            if scoped_driver_id is None or route.driver_id == scoped_driver_id:
                for client in route.clients.all():
                    stop_clients[client.client_id] = client
            for route_id, client_id in orders_by_stop:
                if route_id == route.route_id:
                    stop_clients.setdefault(client_id, client_by_id[client_id])

            stops = []
            for client_id, client in stop_clients.items():
                shown_stops.add((route.route_id, client_id))
                stops.append(_stop_payload(client, orders_by_stop.get((route.route_id, client_id), []), proofs_by_client.get(client_id, []), returns_by_client.get(client_id)))
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
                _stop_payload(client_by_id[client_id], orders, proofs_by_client.get(client_id, []), returns_by_client.get(client_id))
                for (route_id, client_id), orders in orders_by_stop.items()
                if (route_id, client_id) not in shown_stops
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

MAX_CLOCK_SKEW = timedelta(minutes=5)

def _occurred_at(request):
    raw = request.headers.get('X-Occurred-At')
    if not raw:
        return timezone.now(), None
    try:
        moment = datetime.fromisoformat(raw)
    except ValueError:
        return None, 'Nieprawidłowy czas akcji.'
    if timezone.is_naive(moment):
        return None, 'Czas akcji musi zawierać strefę czasową.'
    now = timezone.now()
    if moment > now + MAX_CLOCK_SKEW:
        return None, 'Czas akcji nie może być w przyszłości.'
    if moment.astimezone().date() != date.today():
        return None, 'Akcja z innego dnia nie może zostać zapisana.'
    return min(moment, now), None

def idempotent_action(view_method):
    @wraps(view_method)
    def wrapper(self, request, *args, **kwargs):
        raw_id = request.headers.get('X-Client-Action-Id')
        if not raw_id:
            return view_method(self, request, *args, **kwargs)
        try:
            action_id = uuid.UUID(raw_id)
        except ValueError:
            return Response(
                {'error': 'Nieprawidłowy identyfikator akcji.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        if ClientAction.objects.filter(action_id=action_id).exists():
            return Response({'duplicate': True})
        try:
            with transaction.atomic():
                response = view_method(self, request, *args, **kwargs)
                if 200 <= response.status_code < 300:
                    ClientAction.objects.create(action_id=action_id, user=request.user)
        except IntegrityError:
            return Response({'duplicate': True})
        return response
    return wrapper

ISSUE_SOURCE_STATUSES = {'planned', 'in_production', 'failed'}

def _snapshot_assignment(order):
    route = order.client.route
    order.assigned_route = route
    order.assigned_driver = route.driver

def _order_driver_id(order):
    if order.assigned_route_id is not None:
        return order.assigned_driver_id
    return order.client.route.driver_id

def _with_effective_assignment(queryset):
    return queryset.annotate(
        effective_route_id=Coalesce('assigned_route_id', 'client__route_id', output_field=IntegerField()),
        effective_driver_id=Case(
            When(assigned_route__isnull=False, then=F('assigned_driver_id')),
            default=F('client__route__driver_id'),
            output_field=IntegerField(),
        ),
    )

def _orders_for_user(queryset, user):
    if user.role == 'driver':
        return _with_effective_assignment(queryset).filter(effective_driver_id=user.user_id)
    return queryset


def _driver_can_access_stop(driver_id, client):
    if client.route.driver_id == driver_id:
        return True
    return _orders_for_driver_today(client, driver_id).exists()


def _orders_for_driver_today(client, driver_id):
    return _with_effective_assignment(
        DailyOrder.objects.filter(client=client, order_date=date.today())
    ).filter(effective_driver_id=driver_id)


def _stop_payload(client, orders, proofs=(), returns=None):
    return {
        'client_id': client.client_id,
        'name': client.name,
        'address': client.address,
        'phone': client.phone,
        'latitude': client.latitude,
        'longitude': client.longitude,
        'orders': orders,
        'proofs': list(proofs) if orders else [],
        'returns': returns if orders else None,
    }

MAX_PROOF_SIZE = 5 * 1024 * 1024
ALLOWED_PROOF_FORMATS = {'JPEG', 'PNG', 'WEBP'}
MAX_SIGNER_NAME_LENGTH = 100


def _validate_proof_image(upload):
    try:
        with Image.open(upload) as image:
            image.verify()
            image_format = image.format
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        return 'Plik nie jest prawidłowym obrazem.'
    finally:
        upload.seek(0)
    if image_format not in ALLOWED_PROOF_FORMATS:
        return 'Dozwolone formaty obrazu: JPEG, PNG, WEBP.'
    return None


def _proof_payload(proof):
    return {
        'proof_id': proof.proof_id,
        'kind': proof.kind,
        'signer_name': proof.signer_name,
        'created_at': proof.created_at,
    }

def _driver_can_access_proof(driver_id, proof):
    if proof.uploaded_by_id == driver_id:
        return True
    return _with_effective_assignment(
        DailyOrder.objects.filter(client_id=proof.client_id, order_date=proof.order_date)
    ).filter(effective_driver_id=driver_id).exists()

def _within_driver_undo_window(moment, reference=None):
    reference = reference or timezone.now()
    return moment is not None and reference - moment <= DRIVER_UNDO_WINDOW

MAX_NOTE_LENGTH = 500


def _notify_admins(sender, title, message):
    admins = User.objects.filter(role='admin', is_active=True).exclude(pk=sender.pk)
    Notification.objects.bulk_create([
        Notification(user=admin, sender=sender, title=title, message=message)
        for admin in admins
    ])

def _format_order_items(orders):
    return ', '.join(f'{o.product.name} x{o.quantity}' for o in orders)


STATUS_LABELS = dict(DailyOrder.STATUS_CHOICES)


def _stop_label(client, day=None):
    return f'{client.name}, {(day or date.today()):%d.%m.%Y}'


def _status_change(old, new):
    return field_changes({'status': STATUS_LABELS[old]}, {'status': STATUS_LABELS[new]}, {'status': 'Status'})


def _returns_state(client, return_date):
    return {
        name: f'{quantity} szt.'
        for name, quantity in ProductReturn.objects
        .filter(client=client, return_date=return_date)
        .values_list('product__name', 'quantity')
    }


def _named_changes(before, after):
    return field_changes(before, after, {name: name for name in sorted(before.keys() | after.keys())})


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
    occurred_at, time_error = _occurred_at(request)
    if time_error:
        return Response({'error': time_error}, status=http_status.HTTP_400_BAD_REQUEST)

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
    if len(note) > MAX_NOTE_LENGTH:
        return Response(
            {'error': f'Notatka może mieć najwyżej {MAX_NOTE_LENGTH} znaków.'},
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
        DailyOrder.objects.filter(pk__in=failed_ids).update(
            status='failed',
            failure_reason=reason,
            failure_note=note,
            failed_at=occurred_at,
            updated_at=timezone.now(),
        )
        _notify_admins_about_failure(request.user, client, orders, reason, note)
        reason_label = dict(DailyOrder.FAILURE_REASON_CHOICES)[reason]
        description = (
            f'Zgłoszono problem z dostawą do klienta {client.name}: {reason_label} '
            f'({_format_order_items(orders)}).'
        )
        if note:
            description += f' Notatka: {note}'
        record_event(
            request, category='logistics', action='delivery.failed', obj=client,
            object_label=_stop_label(client), description=description,
            changes=_status_change('in_delivery', 'failed'),
        )

    return Response({
        'client_id': client.client_id,
        'failed_ids': failed_ids,
        'failure_reason': reason,
        'failure_note': note,
        'failed_at': occurred_at,
    })

class UpdateOrderStatusView(APIView):
    permission_classes = [IsAuthenticated]

    @idempotent_action
    def patch(self, request, pk):
        user = request.user
        occurred_at, time_error = _occurred_at(request)
        if time_error:
            return Response({'error': time_error}, status=http_status.HTTP_400_BAD_REQUEST)
        order = get_object_or_404(DailyOrder.objects.select_related('client__route', 'product'), pk=pk)
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
            if _order_driver_id(order) != user.user_id:
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
            if order.status == 'delivered' and not _within_driver_undo_window(order.delivered_at, occurred_at):
                return Response(
                    {'error': 'Czas na cofnięcie dostawy minął. Skontaktuj się z biurem.'},
                    status=http_status.HTTP_403_FORBIDDEN,
                )
        elif user.role not in ('admin', 'driver'):
            return Response(
                {'error': 'Brak dostępu do modułu logistyki.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        old_status = order.status
        if new_status == 'delivered' and order.status != 'delivered':
            order.delivered_at = occurred_at
        elif new_status != 'delivered':
            order.delivered_at = None
            order.delivery_note = ''
        if new_status in ('in_delivery', 'delivered') and (
            order.status in ISSUE_SOURCE_STATUSES or order.assigned_route_id is None
        ):
            _snapshot_assignment(order)

        order.failure_reason = ''
        order.failure_note = ''
        order.failed_at = None
        order.status = new_status
        with transaction.atomic():
            order.save(update_fields=[
                'status', 'delivered_at', 'delivery_note', 'failure_reason', 'failure_note', 'failed_at',
                'assigned_route', 'assigned_driver', 'updated_at',
            ])
            changes = _status_change(old_status, new_status)
            if changes:
                record_event(
                    request, category='logistics', action='order.status_changed', obj=order,
                    object_label=_stop_label(order.client, order.order_date),
                    description=(
                        f'Zmieniono status zamówienia „{order.product.name} x{order.quantity}” '
                        f'klienta {order.client.name}.'
                    ),
                    changes=changes,
                )
        return Response({'do_id': order.do_id, 'status': order.status, 'delivered_at': order.delivered_at})

class DeliverStopView(APIView):
    permission_classes = [IsAuthenticated]

    @idempotent_action
    def post(self, request, pk):
        user = request.user
        occurred_at, time_error = _occurred_at(request)
        if time_error:
            return Response({'error': time_error}, status=http_status.HTTP_400_BAD_REQUEST)

        if user.role not in ('admin', 'driver'):
            return Response(
                {'error': 'Brak dostępu do modułu logistyki.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        client = get_object_or_404(Client, pk=pk)

        if user.role == 'driver' and not _driver_can_access_stop(user.user_id, client):
            return Response(
                {'error': 'Nie masz dostępu do tego przystanku.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        with transaction.atomic():
            delivered_ids = list(
                _orders_for_user(DailyOrder.objects.filter(client=client), user)
                .select_for_update(of=('self',))
                .filter(order_date=date.today(), status='in_delivery')
                .values_list('do_id', flat=True)
            )
            if not delivered_ids:
                return Response(
                    {'error': 'U tego klienta nie ma dziś zamówień w dostawie.'},
                    status=http_status.HTTP_400_BAD_REQUEST,
                )
            DailyOrder.objects.filter(pk__in=delivered_ids).update(
                status='delivered',
                delivered_at=occurred_at,
                updated_at=timezone.now(),
            )
            orders = DailyOrder.objects.filter(pk__in=delivered_ids).select_related('product')
            record_event(
                request, category='logistics', action='stop.delivered', obj=client,
                object_label=_stop_label(client),
                description=f'Dostarczono zamówienia do klienta {client.name} ({_format_order_items(orders)}).',
                changes=_status_change('in_delivery', 'delivered'),
            )

        return Response({'client_id': client.client_id, 'delivered_ids': delivered_ids, 'delivered_at': occurred_at})
class StopDeliveryNoteView(APIView):
    permission_classes = [IsAuthenticated]

    @idempotent_action
    def post(self, request, pk):
        user = request.user

        if user.role not in ('admin', 'driver'):
            return Response(
                {'error': 'Brak dostępu do modułu logistyki.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        client = get_object_or_404(Client, pk=pk)

        if user.role == 'driver' and not _driver_can_access_stop(user.user_id, client):
            return Response(
                {'error': 'Nie masz dostępu do tego przystanku.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        note = request.data.get('note', '')
        if not isinstance(note, str):
            return Response(
                {'error': 'Notatka musi być tekstem.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        note = note.strip()
        if len(note) > MAX_NOTE_LENGTH:
            return Response(
                {'error': f'Notatka może mieć najwyżej {MAX_NOTE_LENGTH} znaków.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            delivered = list(
                _orders_for_user(DailyOrder.objects.filter(client=client), user)
                .select_for_update(of=('self',))
                .filter(order_date=date.today(), status='delivered')
                .values_list('do_id', 'delivery_note')
            )
            if not delivered:
                return Response(
                    {'error': 'U tego klienta nie ma dziś dostarczonych zamówień.'},
                    status=http_status.HTTP_400_BAD_REQUEST,
                )
            updated_ids = [do_id for do_id, _ in delivered]
            DailyOrder.objects.filter(pk__in=updated_ids).update(
                delivery_note=note,
                updated_at=timezone.now(),
            )
            changes = field_changes({'note': delivered[0][1]}, {'note': note}, {'note': 'Notatka'})
            if changes:
                record_event(
                    request, category='logistics', action='stop.note_changed', obj=client,
                    object_label=_stop_label(client),
                    description=f'Zmieniono notatkę do dostawy u klienta {client.name}.',
                    changes=changes,
                )

        return Response({'client_id': client.client_id, 'updated_ids': updated_ids, 'delivery_note': note})


RETURNABLE_STOP_STATUSES = ('in_delivery', 'delivered')


def _parse_return_items(raw_items):
    if not isinstance(raw_items, list):
        return None, 'Lista zwrotów musi być tablicą.'
    items = {}
    for entry in raw_items:
        if not isinstance(entry, dict):
            return None, 'Nieprawidłowa pozycja zwrotu.'
        product_id, quantity = entry.get('product_id'), entry.get('quantity')
        if any(not isinstance(v, int) or isinstance(v, bool) for v in (product_id, quantity)):
            return None, 'Produkt i ilość muszą być liczbami całkowitymi.'
        if quantity < 0:
            return None, 'Ilość zwrotu nie może być ujemna.'
        if product_id in items:
            return None, 'Każdy produkt może wystąpić na liście tylko raz.'
        items[product_id] = quantity
    return items, None

class StopReturnsView(APIView):
    permission_classes = [IsAuthenticated]

    @idempotent_action
    def post(self, request, pk):
        user = request.user

        if user.role not in ('admin', 'driver'):
            return Response(
                {'error': 'Brak dostępu do modułu logistyki.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        client = get_object_or_404(Client, pk=pk)

        if user.role == 'driver':
            _, time_error = _occurred_at(request)
            if time_error:
                return Response({'error': time_error}, status=http_status.HTTP_400_BAD_REQUEST)
            if not _driver_can_access_stop(user.user_id, client):
                return Response(
                    {'error': 'Nie masz dostępu do tego przystanku.'},
                    status=http_status.HTTP_403_FORBIDDEN,
                )
            if not _orders_for_driver_today(client, user.user_id).filter(status__in=RETURNABLE_STOP_STATUSES).exists():
                return Response(
                    {'error': 'Zwrot można zapisać tylko przy przystanku w dostawie lub już dostarczonym.'},
                    status=http_status.HTTP_400_BAD_REQUEST,
                )
            return_date = date.today()
        else:
            try:
                return_date = date.fromisoformat(request.data.get('date') or str(date.today()))
            except (TypeError, ValueError):
                return Response(
                    {'error': 'Nieprawidłowy format daty (YYYY-MM-DD).'},
                    status=http_status.HTTP_400_BAD_REQUEST,
                )

        items, items_error = _parse_return_items(request.data.get('items'))
        if items_error:
            return Response({'error': items_error}, status=http_status.HTTP_400_BAD_REQUEST)

        returnable = last_delivery_items([client.client_id], return_date).get(client.client_id)
        allowed = {item['product_id']: item for item in returnable['items']} if returnable else {}
        to_save = {product_id: quantity for product_id, quantity in items.items() if quantity > 0}

        for product_id, quantity in to_save.items():
            item = allowed.get(product_id)
            if item is None:
                return Response(
                    {'error': 'Można zwrócić tylko produkty z ostatniej dostawy do tego klienta.'},
                    status=http_status.HTTP_400_BAD_REQUEST,
                )
            if quantity > item['quantity']:
                return Response(
                    {'error': f'{item["product_name"]}: zwrot ({quantity}) większy niż dostawa ({item["quantity"]}).'},
                    status=http_status.HTTP_400_BAD_REQUEST,
                )

        with transaction.atomic():
            before = _returns_state(client, return_date)
            ProductReturn.objects.filter(client=client, return_date=return_date).exclude(
                product_id__in=to_save.keys()
            ).delete()
            for product_id, quantity in to_save.items():
                ProductReturn.objects.update_or_create(
                    client=client,
                    product_id=product_id,
                    return_date=return_date,
                    defaults={
                        'source_date': returnable['source_date'],
                        'quantity': quantity,
                        'unit_price': allowed[product_id]['unit_price'],
                        'recorded_by': user,
                    },
                )
            changes = _named_changes(before, _returns_state(client, return_date))
            if changes:
                record_event(
                    request, category='logistics', action='returns.updated', obj=client,
                    object_label=_stop_label(client, return_date),
                    description=f'Zapisano zwroty towaru od klienta {client.name} z dnia {return_date:%d.%m.%Y}.',
                    changes=changes,
                )

        return Response({
            'client_id': client.client_id,
            'date': str(return_date),
            'returns': returns_overview([client.client_id], return_date).get(client.client_id),
        })

class StopDeliveryProofView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    @idempotent_action
    def post(self, request, pk):
        user = request.user

        if user.role not in ('admin', 'driver'):
            return Response(
                {'error': 'Brak dostępu do modułu logistyki.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        client = get_object_or_404(Client, pk=pk)

        if user.role == 'driver' and not _driver_can_access_stop(user.user_id, client):
            return Response(
                {'error': 'Nie masz dostępu do tego przystanku.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        kind = request.data.get('kind')
        if kind not in dict(DeliveryProof.KIND_CHOICES):
            return Response(
                {'error': 'Nieznany rodzaj potwierdzenia.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        upload = request.FILES.get('image')
        if upload is None:
            return Response(
                {'error': 'Dołącz plik obrazu.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        if upload.size > MAX_PROOF_SIZE:
            return Response(
                {'error': 'Plik jest za duży (maksymalnie 5 MB).'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        image_error = _validate_proof_image(upload)
        if image_error:
            return Response({'error': image_error}, status=http_status.HTTP_400_BAD_REQUEST)

        signer_name = str(request.data.get('signer_name') or '').strip() if kind == 'signature' else ''
        if len(signer_name) > MAX_SIGNER_NAME_LENGTH:
            return Response(
                {'error': f'Imię i nazwisko może mieć najwyżej {MAX_SIGNER_NAME_LENGTH} znaków.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        today = date.today()
        delivered_orders = _orders_for_user(
            DailyOrder.objects.filter(client=client, order_date=today, status='delivered'), user
        )
        if not delivered_orders.exists():
            return Response(
                {'error': 'Potwierdzenie można dodać tylko do dostarczonego przystanku.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            previous = (
                DeliveryProof.objects
                .select_for_update()
                .filter(client=client, order_date=today, kind=kind)
                .first()
            )
            if previous is not None:
                old_storage, old_name = previous.image.storage, previous.image.name
                previous.delete()
                transaction.on_commit(lambda: old_storage.delete(old_name))

            proof = DeliveryProof.objects.create(
                client=client,
                order_date=today,
                kind=kind,
                image=upload,
                signer_name=signer_name,
                uploaded_by=user,
            )
            description = (
                f'{"Zastąpiono" if previous is not None else "Dodano"} potwierdzenie dostawy '
                f'({proof.get_kind_display().lower()}) u klienta {client.name}.'
            )
            if signer_name:
                description += f' Osoba podpisująca: {signer_name}.'
            record_event(
                request, category='logistics',
                action='proof.replaced' if previous is not None else 'proof.added',
                obj=proof, object_label=_stop_label(client, today), description=description,
            )

        return Response(_proof_payload(proof), status=http_status.HTTP_201_CREATED)

class DeliveryProofFileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        user = request.user

        if user.role not in ('admin', 'driver'):
            return Response(
                {'error': 'Brak dostępu do modułu logistyki.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        proof = get_object_or_404(DeliveryProof, pk=pk)

        if user.role == 'driver' and not _driver_can_access_proof(user.user_id, proof):
            return Response(
                {'error': 'Nie masz dostępu do tego potwierdzenia.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        if not proof.image.storage.exists(proof.image.name):
            return Response(
                {'error': 'Plik potwierdzenia nie istnieje.'},
                status=http_status.HTTP_404_NOT_FOUND,
            )

        content_type = mimetypes.guess_type(proof.image.name)[0] or 'application/octet-stream'
        response = FileResponse(proof.image.open('rb'), content_type=content_type)
        response['Cache-Control'] = 'private, max-age=3600'
        response['X-Content-Type-Options'] = 'nosniff'
        return response

class DeliveryProofDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @idempotent_action
    def delete(self, request, pk):
        user = request.user

        if user.role not in ('admin', 'driver'):
            return Response(
                {'error': 'Brak dostępu do modułu logistyki.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        proof = get_object_or_404(DeliveryProof, pk=pk)

        if user.role == 'driver' and (proof.uploaded_by_id != user.user_id or proof.order_date != date.today()):
            return Response(
                {'error': 'Możesz usuwać tylko własne dzisiejsze potwierdzenia.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        storage, name = proof.image.storage, proof.image.name
        with transaction.atomic():
            record_event(
                request, category='logistics', action='proof.deleted', obj=proof,
                object_label=_stop_label(proof.client, proof.order_date),
                description=(
                    f'Usunięto potwierdzenie dostawy ({proof.get_kind_display().lower()}) '
                    f'u klienta {proof.client.name}.'
                ),
            )
            proof.delete()
            transaction.on_commit(lambda: storage.delete(name))

        return Response(status=http_status.HTTP_204_NO_CONTENT)

class ReportStopProblemView(APIView):
    permission_classes = [IsAuthenticated]

    @idempotent_action
    def post(self, request, pk):
        user = request.user

        if user.role not in ('admin', 'driver'):
            return Response(
                {'error': 'Brak dostępu do modułu logistyki.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        client = get_object_or_404(Client, pk=pk)

        if user.role == 'driver' and not _driver_can_access_stop(user.user_id, client):
            return Response(
                {'error': 'Nie masz dostępu do tego przystanku.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        return _report_failure(request, client, _orders_for_user(DailyOrder.objects.filter(client=client), user))


class ReportOrderProblemView(APIView):
    permission_classes = [IsAuthenticated]

    @idempotent_action
    def post(self, request, pk):
        user = request.user

        if user.role not in ('admin', 'driver'):
            return Response(
                {'error': 'Brak dostępu do modułu logistyki.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        order = get_object_or_404(DailyOrder.objects.select_related('client__route'), pk=pk)

        if user.role == 'driver' and _order_driver_id(order) != user.user_id:
            return Response(
                {'error': 'Nie masz dostępu do tego zamówienia.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        return _report_failure(request, order.client, DailyOrder.objects.filter(pk=order.pk))

class WithdrawProblemView(APIView):
    permission_classes = [IsAuthenticated]

    @idempotent_action
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

            if user.role == 'driver' and any(_order_driver_id(o) != user.user_id for o in orders):
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
                items = _format_order_items(client_orders)
                _notify_admins(
                    user,
                    f'Zgłoszenie wycofane: {client.name}',
                    f'{user.full_name} wycofał zgłoszenie problemu z dostawą do klienta '
                    f'{client.name} ({client.address}).\n'
                    f'Pozycje: {items}\n'
                    f'Zamówienia wróciły do statusu „W dostawie”.',
                )
                record_event(
                    request, category='logistics', action='delivery.problem_withdrawn', obj=client,
                    object_label=_stop_label(client),
                    description=f'Wycofano zgłoszenie problemu z dostawą do klienta {client.name} ({items}).',
                    changes=_status_change('failed', 'in_delivery'),
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

        route = get_object_or_404(Route, pk=pk)

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

        day_orders = _with_effective_assignment(
            DailyOrder.objects.filter(order_date=target_date).exclude(status='cancelled')
        ).filter(effective_route_id=route.route_id)

        if user.role == 'driver':
            day_orders = day_orders.filter(effective_driver_id=user.user_id)
            if route.driver_id != user.user_id and not day_orders.exists():
                return Response(
                    {'error': 'Nie masz dostępu do tej trasy.'},
                    status=http_status.HTTP_403_FORBIDDEN,
                )

        client_ids_with_orders = set(day_orders.values_list('client_id', flat=True))
        stops = list(Client.objects.filter(client_id__in=client_ids_with_orders).order_by('name'))

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

MAX_STATS_DAYS = 366

class DeliveryStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'admin':
            return Response(
                {'error': 'Statystyki dostaw są dostępne tylko dla administratora.'},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        today = date.today()
        try:
            start = date.fromisoformat(request.query_params.get('start') or str(today - timedelta(days=29)))
            end = date.fromisoformat(request.query_params.get('end') or str(today))
        except ValueError:
            return Response(
                {'error': 'Nieprawidłowy format daty (YYYY-MM-DD).'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        if start > end:
            return Response(
                {'error': 'Data początkowa nie może być późniejsza niż końcowa.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        if (end - start).days >= MAX_STATS_DAYS:
            return Response(
                {'error': f'Okres statystyk może obejmować najwyżej {MAX_STATS_DAYS} dni.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        return Response(build_delivery_stats(start, end))
