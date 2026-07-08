from rest_framework import serializers
from .models import Client, Route

class RouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Route
        fields = ['route_id', 'route_name', 'is_active']

class ClientSerializer(serializers.ModelSerializer):
    route_details = RouteSerializer(source='route', read_only=True)
    nip = serializers.CharField(allow_blank=True, allow_null=True, required=False)

    class Meta:
        model = Client
        fields = [
            'client_id', 
            'name', 
            'address', 
            'nip', 
            'route', 
            'route_details', 
            'is_active'
        ]

    def validate_nip(self, value):
        if value:
            clean_nip = value.replace('-', '').replace(' ', '')
            if not clean_nip.isdigit() or len(clean_nip) != 10:
                raise serializers.ValidationError("NIP musi składać się z 10 cyfr.")
            return clean_nip
        return value