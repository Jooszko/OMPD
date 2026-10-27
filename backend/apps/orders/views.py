from datetime import date as date_cls, timedelta
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from common.openapi import error_response
from users.permissions import AdminOrBaker
from products.models import Product
from .day import LOCKED_STATUSES, build_day
from .history import HISTORY_STATUSES, history_page
from .models import DailyOrder, StandingOrder
from .standing import (
    create_orders_from_standing, record_standing_run, standing_orders_due, summarize_by_client,
)
from common.holidays import is_holiday
from audit.services import field_changes, record_event
from clients.models import Client
from .openapi import (
    DATE_PARAM, DailyOrderGroupSerializer, DailyOrderInputSerializer, MessageSerializer, OrderDaySerializer,
    OrderHistorySerializer, StandingDueCreatedSerializer, StandingDueInputSerializer, StandingDueSerializer,
    StandingOrderGroupSerializer, StandingOrderInputSerializer,
)

DAY_LABELS = {0: 'Pn', 1: 'Wt', 2: 'Śr', 3: 'Czw', 4: 'Pt', 5: 'Sb', 6: 'Nd'}
STATUS_LABELS = dict(DailyOrder.STATUS_CHOICES)
DAILY_EXTRA_LABELS = {'_status': 'Status'}
STANDING_EXTRA_LABELS = {'_days': 'Dni tygodnia'}


def _daily_order_state(order_date, client_id):
    orders = list(DailyOrder.objects.filter(order_date=order_date, client_id=client_id).select_related('product'))
    state = {o.product.name: f'{o.quantity} szt. × {o.price_at_sale} zł' for o in orders}
    if orders:
        state['_status'] = ', '.join(sorted({STATUS_LABELS[o.status] for o in orders}))
    return state

def _stop_lock_reason(order_date, client_id):
    if order_date < timezone.localdate():
        return 'Nie można zmieniać zamówień z minionych dni.'
    locked = DailyOrder.objects.filter(order_date=order_date, client_id=client_id, status__in=LOCKED_STATUSES)
    if locked.exists():
        return 'Zamówienie jest już w dostawie lub dostarczone – nie można go zmienić.'
    return None


def _parse_items(items):
    wanted = {}
    try:
        for item in items:
            qty = int(item['qty'])
            if qty > 0:
                wanted[int(item['product_id'])] = qty
    except (KeyError, TypeError, ValueError):
        return None
    return wanted

def _days_label(days):
    return 'Codziennie' if len(days) == 7 else ', '.join(DAY_LABELS[d] for d in days)


def _parse_schedule(schedule):
    if not isinstance(schedule, list) or not schedule:
        return None, 'Zaznacz przynajmniej jeden dzień dostaw.'
    baskets = {}
    try:
        for entry in schedule:
            day = int(entry['day'])
            items = _parse_items(entry.get('items') or [])
            if day not in DAY_LABELS or day in baskets or items is None:
                return None, 'Nieprawidłowy harmonogram zamówienia stałego.'
            baskets[day] = items
    except (KeyError, TypeError, ValueError, AttributeError):
        return None, 'Nieprawidłowy harmonogram zamówienia stałego.'
    empty = sorted(day for day, items in baskets.items() if not items)
    if empty:
        return None, f'Dodaj produkty na: {", ".join(DAY_LABELS[day] for day in empty)}.'
    return baskets, None


def _standing_order_state(client_id):
    orders = list(StandingOrder.objects.filter(client_id=client_id).select_related('product'))
    if not orders:
        return {}
    days = sorted({o.day_of_week for o in orders})
    quantities = {}
    for o in orders:
        quantities.setdefault(o.product.name, {})[o.day_of_week] = o.quantity
    state = {'_days': _days_label(days)}
    for name, by_day in quantities.items():
        if sorted(by_day) == days and len(set(by_day.values())) == 1:
            state[name] = f'{next(iter(by_day.values()))} szt.'
            continue
        by_quantity = {}
        for day in sorted(by_day):
            by_quantity.setdefault(by_day[day], []).append(day)
        state[name] = ', '.join(f'{qty} szt. ({_days_label(group)})' for qty, group in by_quantity.items())
    return state


def _order_changes(before, after, extra_labels):
    products = sorted(key for key in set(before) | set(after) if not key.startswith('_'))
    return field_changes(before, after, {**extra_labels, **{name: name for name in products}})


def _group_daily_orders(queryset):
    groups = {}
    order_list = []
    for o in queryset:
        key = (o.order_date, o.client_id)
        if key not in groups:
            group = {
                'id': f'{o.order_date}-{o.client_id}',
                'date': str(o.order_date),
                'client_id': o.client_id,
                'client_name': o.client.name,
                'address': o.client.address,
                'status': o.status,
                'is_standing': StandingOrder.objects.filter(
                    client_id=o.client_id, day_of_week=o.order_date.weekday(), is_active=True
                ).exists(),
                'total_quantity': 0,
                'total_amount': 0.0,
                'items': [],
            }
            groups[key] = group
            order_list.append(group)

        group = groups[key]
        group['total_quantity'] += o.quantity
        group['total_amount'] += float(o.quantity) * float(o.price_at_sale)
        group['items'].append({
            'product_id': o.product_id,
            'product_name': o.product.name,
            'qty': o.quantity,
            'price': float(o.price_at_sale)
        })

    for g in order_list:
        g['total_amount'] = round(g['total_amount'], 2)

    return order_list


class DailyOrdersView(APIView):
    permission_classes = [AdminOrBaker]

    @extend_schema(
        summary='Zamówienia z wybranego dnia',
        description='Zamówienia dzienne pogrupowane po klientach (jeden przystanek = klient w danym dniu).',
        parameters=[DATE_PARAM],
        responses={200: DailyOrderGroupSerializer(many=True), 400: error_response('Błędny format daty.')},
    )
    def get(self, request):
        date_param = request.query_params.get('date')
        try:
            target_date = date_cls.fromisoformat(date_param) if date_param else date_cls.today()
        except ValueError:
            return Response({'error': 'Nieprawidłowy format daty.'}, status=status.HTTP_400_BAD_REQUEST)

        qs = (
            DailyOrder.objects
            .filter(order_date=target_date)
            .select_related('client', 'product')
            .order_by('client__name')
        )
        return Response(_group_daily_orders(qs), status=status.HTTP_200_OK)

    @extend_schema(
        summary='Dodanie lub zmiana zamówienia klienta na dzień',
        description=(
            'Zapisuje pełny skład zamówienia klienta na dany dzień: dodaje nowe pozycje, zmienia ilości '
            'i usuwa pozycje, których nie ma na liście. Zmiana trafia do dziennika zmian.'
        ),
        request=DailyOrderInputSerializer,
        responses={
            201: DailyOrderGroupSerializer(many=True),
            400: error_response('Brak klienta, produktów albo błędna data.'),
            404: OpenApiResponse(description='Nie znaleziono klienta lub produktu.'),
            409: error_response('Miniony dzień albo zamówienie jest już w dostawie.'),
        },
    )
    def post(self, request):
        client_id = request.data.get('client_id')
        order_date_str = request.data.get('order_date') or str(timezone.localdate())
        wanted = _parse_items(request.data.get('items') or [])

        if not client_id or not wanted:
            return Response({'error': 'Wybierz klienta i dodaj przynajmniej jeden produkt.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order_date = date_cls.fromisoformat(order_date_str)
        except ValueError:
            return Response({'error': 'Błędny format daty.'}, status=status.HTTP_400_BAD_REQUEST)
        client = get_object_or_404(Client, pk=client_id)
        lock_reason = _stop_lock_reason(order_date, client.pk)
        if lock_reason:
            return Response({'error': lock_reason}, status=status.HTTP_409_CONFLICT)

        with transaction.atomic():
            before = _daily_order_state(order_date, client.pk)
            products = {product_id: get_object_or_404(Product, pk=product_id) for product_id in wanted}
            existing = {
                order.product_id: order
                for order in DailyOrder.objects.select_for_update().filter(order_date=order_date, client=client)
            }
            template = next((order for order in existing.values() if order.status != 'cancelled'), None)

            for product_id, order in existing.items():
                if product_id not in wanted:
                    order.delete()
            for product_id, qty in wanted.items():
                order = existing.get(product_id)
                if order is None:
                    DailyOrder.objects.create(
                        client=client,
                        product=products[product_id],
                        order_date=order_date,
                        quantity=qty,
                        price_at_sale=products[product_id].base_price,
                        status=template.status if template else 'planned',
                        assigned_route=template.assigned_route if template else None,
                        assigned_driver=template.assigned_driver if template else None,
                    )
                elif order.quantity != qty:
                    order.quantity = qty
                    order.save(update_fields=['quantity', 'updated_at'])

            changes = _order_changes(before, _daily_order_state(order_date, client.pk), DAILY_EXTRA_LABELS)
            if changes:
                record_event(
                    request, category='orders',
                    action='order.updated' if before else 'order.created',
                    obj=client, object_label=f'{client.name}, {order_date:%d.%m.%Y}', changes=changes,
                    description=(
                        f'{"Zmieniono" if before else "Dodano"} zamówienie klienta {client.name} '
                        f'na {order_date:%d.%m.%Y}.'
                    ),
                )

        qs = DailyOrder.objects.filter(order_date=order_date, client=client).select_related('client', 'product')
        return Response(_group_daily_orders(qs), status=status.HTTP_201_CREATED)

    @extend_schema(
        summary='Usunięcie zamówienia klienta z dnia',
        parameters=[
            OpenApiParameter('id', str, required=True, description='Identyfikator przystanku: RRRR-MM-DD-id_klienta.'),
        ],
        responses={
            204: OpenApiResponse(description='Usunięto.'),
            400: error_response('Brak lub błędny identyfikator.'),
            409: error_response('Miniony dzień albo zamówienie jest już w dostawie.'),
        },
    )
    def delete(self, request):
        order_id = request.query_params.get('id')  # format: 'YYYY-MM-DD-client_id'
        if not order_id:
            return Response({'error': 'Brak parametru id.'}, status=status.HTTP_400_BAD_REQUEST)

        parts = order_id.rsplit('-', 1)
        if len(parts) != 2:
            return Response({'error': 'Błędny format id.'}, status=status.HTTP_400_BAD_REQUEST)

        target_date_str, client_id_str = parts
        try:
            target_date = date_cls.fromisoformat(target_date_str)
            client_id = int(client_id_str)
        except ValueError:
            return Response({'error': 'Nieprawidłowe dane id.'}, status=status.HTTP_400_BAD_REQUEST)
        lock_reason = _stop_lock_reason(target_date, client_id)
        if lock_reason:
            return Response({'error': lock_reason}, status=status.HTTP_409_CONFLICT)

        with transaction.atomic():
            before = _daily_order_state(target_date, client_id)
            DailyOrder.objects.filter(order_date=target_date, client_id=client_id).delete()
            if before:
                client = Client.objects.filter(pk=client_id).first()
                name = client.name if client else f'#{client_id}'
                record_event(
                    request, category='orders', action='order.deleted', obj=client,
                    object_label=f'{name}, {target_date:%d.%m.%Y}',
                    description=f'Usunięto zamówienie klienta {name} na {target_date:%d.%m.%Y}.',
                    changes=_order_changes(before, {}, DAILY_EXTRA_LABELS),
                )
        return Response(status=status.HTTP_204_NO_CONTENT)


class OrderHistoryView(APIView):
    permission_classes = [AdminOrBaker]

    @extend_schema(
        summary='Historia zamówień',
        description='Zamówienia z wybranego okresu pogrupowane po przystankach, po 25 na stronę, od najnowszych.',
        parameters=[
            OpenApiParameter('date_from', str, description='Początek okresu RRRR-MM-DD (domyślnie 30 dni przed końcem).'),
            OpenApiParameter('date_to', str, description='Koniec okresu RRRR-MM-DD (domyślnie wczoraj).'),
            OpenApiParameter('q', str, description='Fragment nazwy klienta.'),
            OpenApiParameter(
                'status', str, enum=list(HISTORY_STATUSES), description='open = zamówienia jeszcze niezakończone.',
            ),
            OpenApiParameter('page', int, description='Numer strony (od 1).'),
        ],
        responses={200: OrderHistorySerializer, 400: error_response('Błędny filtr.')},
    )
    def get(self, request):
        params = request.query_params
        yesterday = timezone.localdate() - timedelta(days=1)
        try:
            date_to = date_cls.fromisoformat(params['date_to']) if params.get('date_to') else yesterday
            date_from = date_cls.fromisoformat(params['date_from']) if params.get('date_from') else date_to - timedelta(days=29)
            page = int(params.get('page') or 1)
        except ValueError:
            return Response({'error': 'Nieprawidłowy filtr historii.'}, status=status.HTTP_400_BAD_REQUEST)
        if date_from > date_to:
            return Response({'error': 'Data początkowa jest późniejsza niż końcowa.'}, status=status.HTTP_400_BAD_REQUEST)
        order_status = params.get('status') or ''
        if order_status and order_status not in HISTORY_STATUSES:
            return Response({'error': 'Nieznany status.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(history_page(date_from, date_to, (params.get('q') or '').strip(), order_status, page))

class StandingOrdersView(APIView):
    permission_classes = [AdminOrBaker]

    @extend_schema(
        summary='Lista zamówień stałych',
        description='Aktywne zamówienia stałe pogrupowane po klientach, z dniami tygodnia i składem.',
        responses={200: StandingOrderGroupSerializer(many=True)},
    )
    def get(self, request):
        qs = (
            StandingOrder.objects
            .filter(is_active=True)
            .select_related('client__route__driver', 'product')
            .order_by('client__name', 'day_of_week', 'product__name')
        )

        groups = {}
        order_list = []
        for so in qs:
            key = so.client_id
            if key not in groups:
                group = {
                    'id': so.client_id,
                    'client_id': so.client_id,
                    'client_name': so.client.name,
                    'address': so.client.address,
                    'client_active': so.client.is_active,
                    'route_id': so.client.route_id,
                    'route_name': so.client.route.route_name,
                    'driver_name': so.client.route.driver.full_name if so.client.route.driver else None,
                    'days_map': {},
                }
                groups[key] = group
                order_list.append(group)

            groups[key]['days_map'].setdefault(so.day_of_week, []).append({
                'product_id': so.product_id,
                'product_name': so.product.name,
                'qty': so.quantity,
                'price': float(so.price_at_sale),
            })

        for g in order_list:
            schedule = [
                {
                    'day': day,
                    'items': items,
                    'total_quantity': sum(item['qty'] for item in items),
                    'total_amount': round(sum(item['qty'] * item['price'] for item in items), 2),
                }
                for day, items in sorted(g.pop('days_map').items())
            ]
            days = [entry['day'] for entry in schedule]
            baskets = {tuple((item['product_id'], item['qty']) for item in entry['items']) for entry in schedule}
            g['days_ids'] = days
            g['day_of_week'] = _days_label(days)
            g['schedule'] = schedule
            g['same_every_day'] = len(baskets) == 1
            g['weekly_quantity'] = sum(entry['total_quantity'] for entry in schedule)
            g['weekly_amount'] = round(sum(entry['total_amount'] for entry in schedule), 2)

        return Response(order_list, status=status.HTTP_200_OK)

    @extend_schema(
        summary='Zapis zamówienia stałego klienta',
        description=(
            'Zastępuje całe zamówienie stałe klienta harmonogramem dzień po dniu – '
            'każdy dzień tygodnia może mieć inny skład.'
        ),
        request=StandingOrderInputSerializer,
        responses={
            201: MessageSerializer,
            400: error_response('Brak klienta, dni lub produktów w którymś dniu.'),
            404: OpenApiResponse(description='Nie znaleziono klienta lub produktu.'),
        },
    )
    def post(self, request):
        client_id = request.data.get('client_id')
        baskets, error = _parse_schedule(request.data.get('schedule'))
        if not client_id:
            error = 'Wybierz klienta.'
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
        client = get_object_or_404(Client, pk=client_id)

        with transaction.atomic():
            before = _standing_order_state(client.pk)
            products = {
                product_id: get_object_or_404(Product, pk=product_id)
                for basket in baskets.values()
                for product_id in basket
            }
            StandingOrder.objects.filter(client=client).delete()
            StandingOrder.objects.bulk_create([
                StandingOrder(
                    client=client,
                    product=products[product_id],
                    day_of_week=day,
                    quantity=qty,
                    price_at_sale=products[product_id].base_price,
                    is_active=True,
                )
                for day, basket in sorted(baskets.items())
                for product_id, qty in basket.items()
            ])
            changes = _order_changes(before, _standing_order_state(client.pk), STANDING_EXTRA_LABELS)
            if changes:
                record_event(
                    request, category='orders',
                    action='standing_order.updated' if before else 'standing_order.created',
                    obj=client, changes=changes,
                    description=f'{"Zmieniono" if before else "Dodano"} zamówienie stałe klienta {client.name}.',
                )

        return Response({'message': 'Harmonogram stały został zapisany.'}, status=status.HTTP_201_CREATED)

    @extend_schema(
        summary='Usunięcie zamówienia stałego klienta',
        parameters=[OpenApiParameter('client_id', int, required=True)],
        responses={
            204: OpenApiResponse(description='Usunięto.'),
            400: error_response('Brak parametru client_id.'),
            404: OpenApiResponse(description='Nie znaleziono klienta.'),
        },
    )
    def delete(self, request):
        client_id = request.query_params.get('client_id')
        if not client_id:
            return Response({'error': 'Brak parametru client_id.'}, status=status.HTTP_400_BAD_REQUEST)
        client = get_object_or_404(Client, pk=client_id)
        with transaction.atomic():
            before = _standing_order_state(client.pk)
            StandingOrder.objects.filter(client=client).delete()
            if before:
                record_event(
                    request, category='orders', action='standing_order.deleted', obj=client,
                    description=f'Usunięto zamówienie stałe klienta {client.name}.',
                    changes=_order_changes(before, {}, STANDING_EXTRA_LABELS),
                )
        return Response(status=status.HTTP_204_NO_CONTENT)

class StandingOrdersDueView(APIView):
    permission_classes = [AdminOrBaker]

    def _summary(self, order_date):
        return {
            'date': str(order_date),
            'is_holiday': is_holiday(order_date),
            'clients': summarize_by_client(standing_orders_due(order_date)),
        }

    @extend_schema(
        summary='Zamówienia stałe do utworzenia na dzień',
        description='Klienci z zamówieniem stałym na ten dzień tygodnia, którzy nie mają jeszcze zamówienia dziennego.',
        parameters=[OpenApiParameter('date', str, required=True, description='Dzień RRRR-MM-DD.')],
        responses={200: StandingDueSerializer, 400: error_response('Błędny format daty.')},
    )
    def get(self, request):
        try:
            order_date = date_cls.fromisoformat(request.query_params.get('date') or '')
        except ValueError:
            return Response({'error': 'Nieprawidłowy format daty.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self._summary(order_date))

    @extend_schema(
        summary='Utworzenie zamówień dziennych z zamówień stałych',
        description='Ręczne uruchomienie tego, co serwer robi automatycznie przy pierwszym zapytaniu danego dnia.',
        request=StandingDueInputSerializer,
        responses={
            201: StandingDueCreatedSerializer,
            400: error_response('Błędny format daty.'),
            409: error_response('Miniony dzień.'),
        },
    )
    def post(self, request):
        try:
            order_date = date_cls.fromisoformat(str(request.data.get('date') or ''))
        except ValueError:
            return Response({'error': 'Nieprawidłowy format daty.'}, status=status.HTTP_400_BAD_REQUEST)
        if order_date < timezone.localdate():
            return Response(
                {'error': 'Nie można tworzyć zamówień na miniony dzień.'}, status=status.HTTP_409_CONFLICT
            )

        with transaction.atomic():
            created = create_orders_from_standing(order_date)
            if created:
                record_standing_run(request, order_date, created)

        return Response(
            {
                'created_clients': len(summarize_by_client(created)),
                'created_items': len(created),
                **self._summary(order_date),
            },
            status=status.HTTP_201_CREATED,
        )


class OrderDayView(APIView):
    permission_classes = [AdminOrBaker]

    @extend_schema(
        summary='Widok dnia zamówień',
        description=(
            'Dane zakładki Zamówienia: podsumowanie, produkty do upieczenia, przystanki pogrupowane po trasach '
            'w kolejności przejazdu, zaległe zamówienia stałe i zmiany względem planu produkcji.'
        ),
        parameters=[DATE_PARAM],
        responses={200: OrderDaySerializer, 400: error_response('Błędny format daty.')},
    )
    def get(self, request):
        date_param = request.query_params.get('date')
        try:
            order_date = date_cls.fromisoformat(date_param) if date_param else timezone.localdate()
        except ValueError:
            return Response({'error': 'Nieprawidłowy format daty.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(build_day(order_date))