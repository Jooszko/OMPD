from drf_spectacular.utils import OpenApiResponse
from rest_framework import serializers

from orders.models import DailyOrder

from .serializers import ClientSerializer


class CardStandingOrderSerializer(serializers.Serializer):
    so_id = serializers.IntegerField()
    day_of_week = serializers.IntegerField(min_value=0, max_value=6, help_text='0 = poniedziałek … 6 = niedziela.')
    product_name = serializers.CharField()
    quantity = serializers.IntegerField()
    price = serializers.DecimalField(max_digits=10, decimal_places=2)


class CardLastDaysSerializer(serializers.Serializer):
    sales = serializers.DecimalField(max_digits=12, decimal_places=2)
    delivered_days = serializers.IntegerField()
    planned_days = serializers.IntegerField()
    returns = serializers.DecimalField(max_digits=12, decimal_places=2)


class CardDeliverySerializer(serializers.Serializer):
    date = serializers.DateField()
    value = serializers.DecimalField(max_digits=12, decimal_places=2)
    status = serializers.ChoiceField(DailyOrder.STATUS_CHOICES)
    status_label = serializers.CharField()


class ClientCardSerializer(ClientSerializer):
    standing_orders = CardStandingOrderSerializer(many=True)
    last_30_days = CardLastDaysSerializer()
    recent_deliveries = CardDeliverySerializer(many=True)

    class Meta(ClientSerializer.Meta):
        fields = ClientSerializer.Meta.fields + ['standing_orders', 'last_30_days', 'recent_deliveries']


class AddressInputSerializer(serializers.Serializer):
    address = serializers.CharField()


class GeocodeMatchSerializer(serializers.Serializer):
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    label = serializers.CharField(help_text='Adres w postaci znalezionej przez serwis map.')


class GeocodingErrorSerializer(serializers.Serializer):
    error = serializers.CharField()
    code = serializers.ChoiceField(['empty', 'not_found', 'unavailable'])


GEOCODING_RESPONSES = {
    400: OpenApiResponse(GeocodingErrorSerializer, description='Pusty adres.'),
    404: OpenApiResponse(GeocodingErrorSerializer, description='Nie znaleziono adresu na mapie.'),
    503: OpenApiResponse(GeocodingErrorSerializer, description='Serwis map nie odpowiada.'),
}