import re

from django.utils import timezone
from rest_framework import serializers
from .models import Client, Route

class RouteSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source='driver.full_name', read_only=True, default=None)

    class Meta:
        model = Route
        fields = ['route_id', 'route_name', 'is_active', 'driver_name']

class ClientSerializer(serializers.ModelSerializer):
    route_details = RouteSerializer(source='route', read_only=True)
    nip = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    phone = serializers.CharField(allow_blank=True, required=False)
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    standing_days = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = [
            'client_id',
            'name',
            'address',
            'nip',
            'phone',
            'route',
            'route_details',
            'is_active',
            'latitude',
            'longitude',
            'geocoded_at',
            'standing_days',
        ]
        read_only_fields = ['geocoded_at']

    def get_standing_days(self, client) -> list[int]:
        return sorted({order.day_of_week for order in client.standing_orders.all() if order.is_active})

    def validate_nip(self, value):
        if value:
            clean_nip = value.replace('-', '').replace(' ', '')
            if not clean_nip.isdigit() or len(clean_nip) != 10:
                raise serializers.ValidationError("NIP musi składać się z 10 cyfr.")
            return clean_nip
        return value

    def validate_phone(self, value):
        if not value:
            return ''
        clean_phone = re.sub(r'[\s\-()]', '', value)
        if not re.fullmatch(r'\+?\d{9,15}', clean_phone):
            raise serializers.ValidationError(
                'Numer telefonu musi mieć od 9 do 15 cyfr (opcjonalnie z + na początku).'
            )
        return clean_phone

    def create(self, validated_data):
        if validated_data.get('latitude') is not None:
            validated_data['geocoded_at'] = timezone.now()
        return super().create(validated_data)

    def update(self, instance, validated_data):
        address_changed = 'address' in validated_data and validated_data['address'] != instance.address
        coords_sent = 'latitude' in self.initial_data or 'longitude' in self.initial_data

        instance = super().update(instance, validated_data)

        if coords_sent:
            instance.geocoded_at = timezone.now() if instance.latitude is not None else None
            instance.save(update_fields=['geocoded_at'])
        elif address_changed:
            instance.latitude = None
            instance.longitude = None
            instance.geocoded_at = None
            instance.save(update_fields=['latitude', 'longitude', 'geocoded_at'])

        return instance