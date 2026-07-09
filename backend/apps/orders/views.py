from datetime import date as date_cls

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

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
        })

    for g in order_list:
        g['total_amount'] = round(g['total_amount'], 2)

    return order_list


class DailyOrdersView(APIView):
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


class OrderHistoryView(APIView):
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
                    'days': set(),
                    'total_quantity': 0,
                    'total_amount': 0.0,
                    'items': [],
                }
                groups[key] = group
                order_list.append(group)

            group = groups[key]
            group['days'].add(so.day_of_week)
            group['total_quantity'] += so.quantity
            group['total_amount'] += float(so.quantity) * float(so.price_at_sale)
            group['items'].append({
                'product_id': so.product_id,
                'product_name': so.product.name,
                'day_label': DAY_LABELS[so.day_of_week],
                'qty': so.quantity,
            })

        for g in order_list:
            days = sorted(g['days'])
            g['day_of_week'] = 'Codziennie' if len(days) == 7 else ', '.join(DAY_LABELS[d] for d in days)
            g['total_amount'] = round(g['total_amount'], 2)
            del g['days']

        return Response(order_list, status=status.HTTP_200_OK)
