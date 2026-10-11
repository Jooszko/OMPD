from datetime import date as date_cls
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from users.permissions import AdminOrBaker
from products.models import Product
from .models import DailyOrder, StandingOrder

DAY_LABELS = {0: 'Pn', 1: 'Wt', 2: 'Śr', 3: 'Czw', 4: 'Pt', 5: 'Sb', 6: 'Nd'}


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
        order_date_str = request.data.get('order_date') or str(date_cls.today())
        items = request.data.get('items', [])
        order_status = request.data.get('status', 'planned')

        if not client_id or not items:
            return Response({'error': 'Wybierz klienta i dodaj przynajmniej jeden produkt.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order_date = date_cls.fromisoformat(order_date_str)
        except ValueError:
            return Response({'error': 'Błędny format daty.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            DailyOrder.objects.filter(order_date=order_date, client_id=client_id).delete()
            for item in items:
                product = get_object_or_404(Product, pk=item['product_id'])
                qty = int(item['qty'])
                if qty > 0:
                    DailyOrder.objects.create(
                        client_id=client_id,
                        product=product,
                        order_date=order_date,
                        quantity=qty,
                        price_at_sale=product.base_price,
                        status=order_status
                    )

        qs = DailyOrder.objects.filter(order_date=order_date, client_id=client_id).select_related('client', 'product')
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

        DailyOrder.objects.filter(order_date=target_date, client_id=client_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class OrderHistoryView(APIView):
    permission_classes = [AdminOrBaker]
    def get(self, request):
        today = date_cls.today()
        qs = (
            DailyOrder.objects
            .filter(order_date__lt=today)
            .select_related('client', 'product')
            .order_by('-order_date', 'client__name')[:500]
        )
        return Response(_group_daily_orders(qs), status=status.HTTP_200_OK)


class StandingOrdersView(APIView):
    permission_classes = [AdminOrBaker]
    def get(self, request):
        qs = (
            StandingOrder.objects
            .filter(is_active=True)
            .select_related('client', 'product')
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

        with transaction.atomic():
            StandingOrder.objects.filter(client_id=client_id).delete()
            for day in days:
                for item in items:
                    product = get_object_or_404(Product, pk=item['product_id'])
                    qty = int(item['qty'])
                    if qty > 0:
                        StandingOrder.objects.create(
                            client_id=client_id,
                            product=product,
                            day_of_week=int(day),
                            quantity=qty,
                            price_at_sale=product.base_price,
                            is_active=True
                        )

        return Response({'message': 'Harmonogram stały został zapisany.'}, status=status.HTTP_201_CREATED)

    def delete(self, request):
        client_id = request.query_params.get('client_id')
        if not client_id:
            return Response({'error': 'Brak parametru client_id.'}, status=status.HTTP_400_BAD_REQUEST)
        StandingOrder.objects.filter(client_id=client_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)