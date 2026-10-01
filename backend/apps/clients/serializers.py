import re

from rest_framework import serializers
from .models import Client, Route

class RouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Route
        fields = ['route_id', 'route_name', 'is_active']

class ClientSerializer(serializers.ModelSerializer):
    route_details = RouteSerializer(source='route', read_only=True)
    nip = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    phone = serializers.CharField(allow_blank=True, required=False)
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)

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
        ]
        read_only_fields = ['geocoded_at']

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

    def update(self, instance, validated_data):
        address_changed = 'address' in validated_data and validated_data['address'] != instance.address
        coords_sent = 'latitude' in self.initial_data or 'longitude' in self.initial_data

        instance = super().update(instance, validated_data)

        if address_changed and not coords_sent:
            instance.latitude = None
            instance.longitude = None
            instance.geocoded_at = None
            instance.save(update_fields=['latitude', 'longitude', 'geocoded_at'])

        return instance