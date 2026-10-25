from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter
from rest_framework import serializers

from orders.models import DailyOrder, DeliveryProof

ORDER_STATUSES = DailyOrder.STATUS_CHOICES
FAILURE_REASONS = DailyOrder.FAILURE_REASON_CHOICES
PROOF_KINDS = DeliveryProof.KIND_CHOICES

DATE_PARAM = OpenApiParameter('date', OpenApiTypes.DATE, description='Dzień RRRR-MM-DD (domyślnie dziś).')
ACTION_ID_HEADER = OpenApiParameter(
    'X-Client-Action-Id', OpenApiTypes.UUID, OpenApiParameter.HEADER,
    description=(
        'Identyfikator akcji z kolejki offline. Ponowne wysłanie tej samej akcji nic nie zmienia '
        'i zwraca {"duplicate": true}.'
    ),
)
OCCURRED_AT_HEADER = OpenApiParameter(
    'X-Occurred-At', OpenApiTypes.DATETIME, OpenApiParameter.HEADER,
    description='Faktyczny czas akcji (ze strefą czasową), gdy kierowca był offline. Musi być z dzisiejszego dnia.',
)
OFFLINE_HEADERS = [ACTION_ID_HEADER, OCCURRED_AT_HEADER]


class WarehouseStockRowSerializer(serializers.Serializer):
    name = serializers.CharField()
    unit = serializers.CharField()
    current_stock = serializers.CharField()
    min_stock_level = serializers.CharField()


class DashboardSerializer(serializers.Serializer):
    warehouse_stock = WarehouseStockRowSerializer(many=True)


class HomeOrderSerializer(serializers.Serializer):
    order_id = serializers.IntegerField()
    client_id = serializers.IntegerField()
    client_name = serializers.CharField()
    product_name = serializers.CharField()
    quantity = serializers.IntegerField()
    status = serializers.ChoiceField(ORDER_STATUSES)
    route_name = serializers.CharField()
    delivered_at = serializers.DateTimeField(allow_null=True)


class HomeOrdersSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    clients = serializers.IntegerField()
    routes = serializers.IntegerField()
    pieces = serializers.IntegerField()
    by_status = serializers.DictField(child=serializers.IntegerField())
    items = HomeOrderSerializer(many=True)


class HomeRouteStopSerializer(serializers.Serializer):
    client_id = serializers.IntegerField()
    client_name = serializers.CharField()
    latitude = serializers.FloatField(allow_null=True)
    longitude = serializers.FloatField(allow_null=True)
    status = serializers.ChoiceField(['waiting', 'in_delivery', 'delivered', 'failed'])
    delivered_at = serializers.DateTimeField(allow_null=True)


class HomeLastDeliverySerializer(serializers.Serializer):
    client_name = serializers.CharField()
    delivered_at = serializers.DateTimeField()


class HomeRouteSerializer(serializers.Serializer):
    route_id = serializers.IntegerField()
    route_name = serializers.CharField()
    driver_name = serializers.CharField()
    state = serializers.ChoiceField(['waiting', 'on_road', 'done'])
    delivered_stops = serializers.IntegerField()
    total_stops = serializers.IntegerField()
    last_delivery = HomeLastDeliverySerializer(allow_null=True)
    stops = HomeRouteStopSerializer(many=True)


class HomeBatchSerializer(serializers.Serializer):
    batch_id = serializers.IntegerField()
    dough_name = serializers.CharField()
    mixer_name = serializers.CharField()
    sequence = serializers.IntegerField()
    batch_count = serializers.IntegerField()
    stage = serializers.CharField()


class HomeProductSerializer(serializers.Serializer):
    name = serializers.CharField()
    quantity = serializers.IntegerField()


class HomeIngredientSerializer(serializers.Serializer):
    name = serializers.CharField()
    unit = serializers.CharField()
    amount = serializers.CharField()


class HomeProductionSerializer(serializers.Serializer):
    production_date = serializers.DateField()
    delivery_date = serializers.DateField()
    has_plan = serializers.BooleanField()
    orders = serializers.IntegerField()
    clients = serializers.IntegerField()
    pieces = serializers.IntegerField()
    standing_clients = serializers.IntegerField()
    standing_pieces = serializers.IntegerField()
    stages = serializers.DictField(child=serializers.IntegerField(), help_text='Liczba partii na każdym etapie.')
    batches = HomeBatchSerializer(many=True)
    products = HomeProductSerializer(many=True)
    ingredients = HomeIngredientSerializer(many=True)


class HomeAlertSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(['failed_deliveries', 'low_stock', 'missing_plan', 'day_not_closed'])
    severity = serializers.ChoiceField(['critical', 'warning'])
    items = serializers.ListField(child=serializers.DictField(), help_text='Szczegóły zależne od rodzaju alertu.')


class HomeTrendDaySerializer(serializers.Serializer):
    date = serializers.DateField()
    revenue = serializers.DecimalField(max_digits=12, decimal_places=2)


class HomeFinanceSerializer(serializers.Serializer):
    revenue = serializers.DecimalField(max_digits=12, decimal_places=2)
    cogs = serializers.DecimalField(max_digits=12, decimal_places=2)
    net_profit = serializers.DecimalField(max_digits=12, decimal_places=2)
    average_revenue = serializers.DecimalField(max_digits=12, decimal_places=2)
    trend = HomeTrendDaySerializer(many=True)


class HomeChangeSerializer(serializers.Serializer):
    entry_id = serializers.IntegerField()
    description = serializers.CharField()
    actor_name = serializers.CharField()
    created_at = serializers.DateTimeField()


class HomeViewerSerializer(serializers.Serializer):
    full_name = serializers.CharField()
    role = serializers.CharField()


class HomeSerializer(serializers.Serializer):
    today = serializers.DateField()
    viewer = HomeViewerSerializer()
    orders = HomeOrdersSerializer()
    routes = HomeRouteSerializer(many=True, help_text='Tylko dla administratora.')
    production = HomeProductionSerializer()
    alerts = HomeAlertSerializer(many=True)
    finance = HomeFinanceSerializer(allow_null=True, help_text='Tylko dla administratora.')
    recent_changes = HomeChangeSerializer(many=True, help_text='Tylko dla administratora.')


class LogisticsOrderSerializer(serializers.Serializer):
    do_id = serializers.IntegerField()
    product_name = serializers.CharField()
    quantity = serializers.IntegerField()
    status = serializers.ChoiceField(ORDER_STATUSES)
    delivered_at = serializers.DateTimeField(allow_null=True)
    delivery_note = serializers.CharField()
    failure_reason = serializers.CharField(help_text=f'Pusty albo jeden z: {", ".join(code for code, _ in FAILURE_REASONS)}.')
    failure_note = serializers.CharField()
    failed_at = serializers.DateTimeField(allow_null=True)


class ProofSerializer(serializers.Serializer):
    proof_id = serializers.IntegerField()
    kind = serializers.ChoiceField(PROOF_KINDS)
    signer_name = serializers.CharField()
    created_at = serializers.DateTimeField()


class ReturnItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    product_name = serializers.CharField()
    delivered_quantity = serializers.IntegerField()
    returned_quantity = serializers.IntegerField()
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2)


class StopReturnsSerializer(serializers.Serializer):
    source_date = serializers.DateField(help_text='Dzień ostatniej dostawy, z której można zwracać towar.')
    items = ReturnItemSerializer(many=True)


class LogisticsStopSerializer(serializers.Serializer):
    client_id = serializers.IntegerField()
    name = serializers.CharField()
    address = serializers.CharField()
    phone = serializers.CharField()
    latitude = serializers.FloatField(allow_null=True)
    longitude = serializers.FloatField(allow_null=True)
    orders = LogisticsOrderSerializer(many=True, help_text='Pusta lista = klient bez dostawy w tym dniu.')
    proofs = ProofSerializer(many=True)
    returns = StopReturnsSerializer(allow_null=True)


class DriverSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    full_name = serializers.CharField()


class LogisticsRouteSerializer(serializers.Serializer):
    route_id = serializers.IntegerField()
    route_name = serializers.CharField()
    driver = DriverSerializer(allow_null=True)
    stops = LogisticsStopSerializer(many=True)


class LogisticsViewerSerializer(serializers.Serializer):
    role = serializers.CharField()
    is_preview = serializers.BooleanField(help_text='Administrator ogląda widok wybranego kierowcy.')
    driver_id = serializers.IntegerField(allow_null=True)


class LogisticsSerializer(serializers.Serializer):
    date = serializers.DateField()
    today = serializers.DateField()
    routes = LogisticsRouteSerializer(many=True)
    unassigned = LogisticsStopSerializer(many=True, help_text='Klienci z zamówieniami, ale bez trasy.')
    viewer = LogisticsViewerSerializer()
    drivers = DriverSerializer(many=True, help_text='Lista kierowców do podglądu – tylko dla administratora.')


class StatusInputSerializer(serializers.Serializer):
    status = serializers.ChoiceField(ORDER_STATUSES, help_text='Status failed ustawia się przez zgłoszenie problemu.')


class StatusResultSerializer(serializers.Serializer):
    do_id = serializers.IntegerField()
    status = serializers.ChoiceField(ORDER_STATUSES)
    delivered_at = serializers.DateTimeField(allow_null=True)


class DeliveredStopSerializer(serializers.Serializer):
    client_id = serializers.IntegerField()
    delivered_ids = serializers.ListField(child=serializers.IntegerField())
    delivered_at = serializers.DateTimeField()


class NoteInputSerializer(serializers.Serializer):
    note = serializers.CharField(allow_blank=True, max_length=500)


class NoteResultSerializer(serializers.Serializer):
    client_id = serializers.IntegerField()
    updated_ids = serializers.ListField(child=serializers.IntegerField())
    delivery_note = serializers.CharField()


class ReturnInputItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=0)


class ReturnsInputSerializer(serializers.Serializer):
    date = serializers.DateField(required=False, help_text='Tylko administrator – kierowca zapisuje zawsze na dziś.')
    items = ReturnInputItemSerializer(many=True, help_text='Pełna lista zwrotów – pominięte produkty są usuwane.')


class ReturnsResultSerializer(serializers.Serializer):
    client_id = serializers.IntegerField()
    date = serializers.DateField()
    returns = StopReturnsSerializer(allow_null=True)


class ProofUploadSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(PROOF_KINDS)
    image = serializers.ImageField(help_text='JPEG, PNG albo WEBP, najwyżej 5 MB.')
    signer_name = serializers.CharField(required=False, max_length=100, help_text='Tylko przy podpisie.')


class ProblemInputSerializer(serializers.Serializer):
    reason = serializers.ChoiceField(FAILURE_REASONS)
    note = serializers.CharField(required=False, allow_blank=True, max_length=500, help_text='Wymagana przy powodzie other.')


class ProblemResultSerializer(serializers.Serializer):
    client_id = serializers.IntegerField()
    failed_ids = serializers.ListField(child=serializers.IntegerField())
    failure_reason = serializers.ChoiceField(FAILURE_REASONS)
    failure_note = serializers.CharField()
    failed_at = serializers.DateTimeField()


class WithdrawInputSerializer(serializers.Serializer):
    order_ids = serializers.ListField(child=serializers.IntegerField())


class WithdrawResultSerializer(serializers.Serializer):
    reverted_ids = serializers.ListField(child=serializers.IntegerField())


class DirectionsGeometrySerializer(serializers.Serializer):
    coordinates = serializers.ListField(
        child=serializers.ListField(child=serializers.FloatField()), help_text='Punkty linii trasy [szerokość, długość].',
    )


class OrderedStopSerializer(serializers.Serializer):
    client_id = serializers.IntegerField()
    name = serializers.CharField()
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()


class DirectionsSerializer(serializers.Serializer):
    geometry = DirectionsGeometrySerializer(allow_null=True)
    distance_m = serializers.FloatField(allow_null=True)
    duration_s = serializers.FloatField(allow_null=True)
    provider = serializers.CharField(allow_null=True, help_text='Serwis, który wyznaczył trasę (OpenRouteService albo OSRM).')
    skipped_stops = serializers.ListField(child=serializers.CharField(), help_text='Przystanki bez współrzędnych.')
    note = serializers.CharField(allow_null=True)
    optimized = serializers.BooleanField(help_text='Czy kolejność przystanków została zoptymalizowana.')
    ordered_stops = OrderedStopSerializer(many=True)


class StatsPeriodSerializer(serializers.Serializer):
    start = serializers.DateField()
    end = serializers.DateField()


class StatsSummarySerializer(serializers.Serializer):
    delivered = serializers.IntegerField()
    failed = serializers.IntegerField()
    pending = serializers.IntegerField()
    success_rate = serializers.FloatField(allow_null=True, help_text='Procent udanych spośród obsłużonych przystanków.')


class StatsDaySerializer(serializers.Serializer):
    date = serializers.DateField()
    delivered = serializers.IntegerField()
    failed = serializers.IntegerField()
    pending = serializers.IntegerField()


class StatsReasonSerializer(serializers.Serializer):
    reason = serializers.CharField()
    label = serializers.CharField()
    count = serializers.IntegerField()


class StatsProblemClientSerializer(serializers.Serializer):
    client_id = serializers.IntegerField()
    name = serializers.CharField()
    failed = serializers.IntegerField()


class StatsDriverSerializer(serializers.Serializer):
    driver_id = serializers.IntegerField(allow_null=True)
    full_name = serializers.CharField()
    delivered = serializers.IntegerField()
    failed = serializers.IntegerField()
    success_rate = serializers.FloatField(allow_null=True)
    days_on_route = serializers.IntegerField()
    avg_stops_per_day = serializers.FloatField()
    avg_route_minutes = serializers.FloatField(allow_null=True)


class StatsProofCoverageSerializer(serializers.Serializer):
    delivered_stops = serializers.IntegerField()
    photo = serializers.IntegerField()
    signature = serializers.IntegerField()
    note = serializers.IntegerField()


class DeliveryStatsSerializer(serializers.Serializer):
    period = StatsPeriodSerializer()
    summary = StatsSummarySerializer()
    daily = StatsDaySerializer(many=True)
    failure_reasons = StatsReasonSerializer(many=True)
    problem_clients = StatsProblemClientSerializer(many=True)
    drivers = StatsDriverSerializer(many=True)
    proof_coverage = StatsProofCoverageSerializer()