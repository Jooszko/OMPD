from drf_spectacular.utils import OpenApiParameter
from rest_framework import serializers

from .models import DailyOrder

ORDER_STATUSES = DailyOrder.STATUS_CHOICES

DATE_PARAM = OpenApiParameter('date', str, description='Dzień w formacie RRRR-MM-DD (domyślnie dziś).')


class OrderItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    product_name = serializers.CharField()
    qty = serializers.IntegerField()
    price = serializers.FloatField()


class DayOrderItemSerializer(OrderItemSerializer):
    status = serializers.ChoiceField(ORDER_STATUSES)


class OrderItemInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    qty = serializers.IntegerField(min_value=0)


class DailyOrderGroupSerializer(serializers.Serializer):
    id = serializers.CharField(help_text='Identyfikator przystanku: RRRR-MM-DD-id_klienta.')
    date = serializers.DateField()
    client_id = serializers.IntegerField()
    client_name = serializers.CharField()
    address = serializers.CharField()
    status = serializers.ChoiceField(ORDER_STATUSES)
    is_standing = serializers.BooleanField()
    total_quantity = serializers.IntegerField()
    total_amount = serializers.FloatField()
    items = OrderItemSerializer(many=True)


class DailyOrderInputSerializer(serializers.Serializer):
    client_id = serializers.IntegerField()
    order_date = serializers.DateField(required=False, help_text='Domyślnie dziś.')
    items = OrderItemInputSerializer(many=True, help_text='Pełny skład zamówienia – pozycje spoza listy zostaną usunięte.')


class DayStopSerializer(serializers.Serializer):
    id = serializers.CharField()
    client_id = serializers.IntegerField()
    client_name = serializers.CharField()
    address = serializers.CharField()
    phone = serializers.CharField()
    is_standing = serializers.BooleanField()
    status = serializers.ChoiceField(ORDER_STATUSES)
    locked = serializers.BooleanField(help_text='Zamówienia nie można już edytować (miniony dzień albo dostawa w toku).')
    total_quantity = serializers.IntegerField()
    total_amount = serializers.FloatField()
    items = DayOrderItemSerializer(many=True)


class DayRouteSerializer(serializers.Serializer):
    route_id = serializers.IntegerField(allow_null=True)
    route_name = serializers.CharField()
    driver_name = serializers.CharField(allow_null=True)
    total_quantity = serializers.IntegerField()
    total_amount = serializers.FloatField()
    driving_order = serializers.ListField(child=serializers.IntegerField(), help_text='Id klientów w kolejności przejazdu.')
    stops = DayStopSerializer(many=True)


class DaySummarySerializer(serializers.Serializer):
    stops = serializers.IntegerField()
    pieces = serializers.IntegerField()
    value = serializers.FloatField()
    by_status = serializers.DictField(child=serializers.IntegerField(), help_text='Liczba przystanków w każdym statusie.')


class DayProductSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    product_name = serializers.CharField()
    quantity = serializers.IntegerField()


class StandingDueCountSerializer(serializers.Serializer):
    clients = serializers.IntegerField()
    items = serializers.IntegerField()


class PlanChangeSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    product_name = serializers.CharField()
    planned_qty = serializers.IntegerField()
    current_qty = serializers.IntegerField()
    difference = serializers.IntegerField()


class DayPlanSerializer(serializers.Serializer):
    production_date = serializers.DateField()
    created_at = serializers.DateTimeField()
    changes = PlanChangeSerializer(many=True)


class OrderDaySerializer(serializers.Serializer):
    date = serializers.DateField()
    is_today = serializers.BooleanField()
    is_past = serializers.BooleanField()
    is_holiday = serializers.BooleanField()
    summary = DaySummarySerializer()
    products = DayProductSerializer(many=True)
    routes = DayRouteSerializer(many=True)
    standing_due = StandingDueCountSerializer(allow_null=True, help_text='Brak dla minionych dni.')
    plan = DayPlanSerializer(allow_null=True, help_text='Plan produkcji na ten dzień i zmiany zamówień od jego utworzenia.')


class HistoryStopSerializer(serializers.Serializer):
    id = serializers.CharField()
    date = serializers.DateField()
    client_id = serializers.IntegerField()
    client_name = serializers.CharField()
    address = serializers.CharField()
    status = serializers.ChoiceField(ORDER_STATUSES)
    total_quantity = serializers.IntegerField()
    total_amount = serializers.FloatField()
    items = DayOrderItemSerializer(many=True)


class HistorySummarySerializer(serializers.Serializer):
    stops = serializers.IntegerField()
    pieces = serializers.IntegerField()
    value = serializers.FloatField()


class OrderHistorySerializer(serializers.Serializer):
    date_from = serializers.DateField()
    date_to = serializers.DateField()
    page = serializers.IntegerField()
    pages = serializers.IntegerField()
    count = serializers.IntegerField()
    summary = HistorySummarySerializer()
    results = HistoryStopSerializer(many=True)


class StandingDaySerializer(serializers.Serializer):
    day = serializers.IntegerField(min_value=0, max_value=6, help_text='0 = poniedziałek … 6 = niedziela.')
    items = OrderItemSerializer(many=True)
    total_quantity = serializers.IntegerField()
    total_amount = serializers.FloatField()


class StandingOrderGroupSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    client_id = serializers.IntegerField()
    client_name = serializers.CharField()
    address = serializers.CharField()
    client_active = serializers.BooleanField()
    route_id = serializers.IntegerField()
    route_name = serializers.CharField()
    driver_name = serializers.CharField(allow_null=True)
    days_ids = serializers.ListField(child=serializers.IntegerField(min_value=0, max_value=6))
    day_of_week = serializers.CharField(help_text='Dni słownie, np. „Pn, Śr, Pt” albo „Codziennie”.')
    schedule = StandingDaySerializer(many=True, help_text='Skład zamówienia w każdym dniu dostaw.')
    same_every_day = serializers.BooleanField(help_text='Czy we wszystkie dni skład jest taki sam.')
    weekly_quantity = serializers.IntegerField()
    weekly_amount = serializers.FloatField()


class StandingDayInputSerializer(serializers.Serializer):
    day = serializers.IntegerField(min_value=0, max_value=6, help_text='0 = poniedziałek … 6 = niedziela.')
    items = OrderItemInputSerializer(many=True)


class StandingOrderInputSerializer(serializers.Serializer):
    client_id = serializers.IntegerField()
    schedule = StandingDayInputSerializer(many=True, help_text='Każdy dzień dostaw z własnym składem.')


class MessageSerializer(serializers.Serializer):
    message = serializers.CharField()


class StandingDueClientSerializer(serializers.Serializer):
    client_id = serializers.IntegerField()
    client_name = serializers.CharField()
    items = serializers.IntegerField()
    total_quantity = serializers.IntegerField()


class StandingDueSerializer(serializers.Serializer):
    date = serializers.DateField()
    is_holiday = serializers.BooleanField()
    clients = StandingDueClientSerializer(many=True)


class StandingDueInputSerializer(serializers.Serializer):
    date = serializers.DateField()


class StandingDueCreatedSerializer(StandingDueSerializer):
    created_clients = serializers.IntegerField()
    created_items = serializers.IntegerField()