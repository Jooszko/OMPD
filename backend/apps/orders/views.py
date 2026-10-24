from datetime import date as date_cls, timedelta
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
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

def _standing_order_state(client_id):
    orders = list(StandingOrder.objects.filter(client_id=client_id).select_related('product'))
    state = {o.product.name: f'{o.quantity} szt.' for o in orders}
    if orders:
        days = sorted({o.day_of_week for o in orders})
        state['_days'] = 'Codziennie' if len(days) == 7 else ', '.join(DAY_LABELS[d] for d in days)
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
    def get(self, request):
        qs = (
            StandingOrder.objects
            .filter(is_active=True)
            .select_related('client__route__driver', 'product')
            .order_by('client__name', 'day_of_week')
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
                    'days_set': set(),
                    'items_map': {},
                }
                groups[key] = group
                order_list.append(group)

            group = groups[key]
            group['days_set'].add(so.day_of_week)

            pid = so.product_id
            if pid not in group['items_map']:
                group['items_map'][pid] = {
                    'product_id': pid,
                    'product_name': so.product.name,
                    'qty': so.quantity,
                    'price': float(so.price_at_sale),
                }

        for g in order_list:
            days = sorted(g['days_set'])
            g['days_ids'] = days
            g['day_of_week'] = 'Codziennie' if len(days) == 7 else ', '.join(DAY_LABELS[d] for d in days)
            
            # Dokładny skład koszyka 1:1
            g['items'] = list(g['items_map'].values())
            
            # Wartości dla pojedynczego zamówienia (bez mnożenia przez dni)
            g['total_quantity'] = sum(item['qty'] for item in g['items'])
            g['total_amount'] = round(sum(item['qty'] * item['price'] for item in g['items']), 2)

            del g['days_set']
            del g['items_map']

        return Response(order_list, status=status.HTTP_200_OK)

    def post(self, request):
        client_id = request.data.get('client_id')
        days = request.data.get('days', [])
        items = request.data.get('items', [])

        if not client_id or not days or not items:
            return Response(
                {'error': 'Wybierz klienta, przynajmniej jeden dzień tygodnia i co najmniej jeden produkt.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        client = get_object_or_404(Client, pk=client_id)

        with transaction.atomic():
            before = _standing_order_state(client.pk)
            StandingOrder.objects.filter(client=client).delete()
            for day in days:
                for item in items:
                    product = get_object_or_404(Product, pk=item['product_id'])
                    qty = int(item['qty'])
                    if qty > 0:
                        StandingOrder.objects.create(
                            client=client,
                            product=product,
                            day_of_week=int(day),
                            quantity=qty,
                            price_at_sale=product.base_price,
                            is_active=True
                        )
            changes = _order_changes(before, _standing_order_state(client.pk), STANDING_EXTRA_LABELS)
            if changes:
                record_event(
                    request, category='orders',
                    action='standing_order.updated' if before else 'standing_order.created',
                    obj=client, changes=changes,
                    description=f'{"Zmieniono" if before else "Dodano"} zamówienie stałe klienta {client.name}.',
                )

        return Response({'message': 'Harmonogram stały został zapisany.'}, status=status.HTTP_201_CREATED)

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

    def get(self, request):
        try:
            order_date = date_cls.fromisoformat(request.query_params.get('date') or '')
        except ValueError:
            return Response({'error': 'Nieprawidłowy format daty.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self._summary(order_date))

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

    def get(self, request):
        date_param = request.query_params.get('date')
        try:
            order_date = date_cls.fromisoformat(date_param) if date_param else timezone.localdate()
        except ValueError:
            return Response({'error': 'Nieprawidłowy format daty.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(build_day(order_date))