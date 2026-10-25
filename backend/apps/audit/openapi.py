from drf_spectacular.utils import OpenApiParameter
from rest_framework import serializers

from .models import AuditEntry
from .serializers import AuditEntrySerializer

AUDIT_FILTERS = [
    OpenApiParameter('category', str, enum=[value for value, _ in AuditEntry.CATEGORY_CHOICES]),
    OpenApiParameter('action', str, description='Kod akcji, np. order.updated (lista w /api/audit/filters/).'),
    OpenApiParameter('actor', int, description='Id użytkownika, który wykonał akcję.'),
    OpenApiParameter('object_type', str, description='Typ obiektu – razem z object_id daje historię jednego obiektu.'),
    OpenApiParameter('object_id', str),
    OpenApiParameter('q', str, description='Szukanie w opisie, nazwie obiektu i autorze.'),
    OpenApiParameter('date_from', str, description='Od dnia RRRR-MM-DD (czas polski).'),
    OpenApiParameter('date_to', str, description='Do dnia RRRR-MM-DD włącznie.'),
    OpenApiParameter('page', int),
    OpenApiParameter('page_size', int, description='Domyślnie 50, najwyżej 200.'),
]


class AuditPageSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.URLField(allow_null=True)
    previous = serializers.URLField(allow_null=True)
    results = AuditEntrySerializer(many=True)


class FilterOptionSerializer(serializers.Serializer):
    value = serializers.CharField()
    label = serializers.CharField()


class ActionOptionSerializer(FilterOptionSerializer):
    category = serializers.CharField()


class ActorOptionSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()


class AuditFiltersSerializer(serializers.Serializer):
    categories = FilterOptionSerializer(many=True)
    actions = ActionOptionSerializer(many=True)
    actors = ActorOptionSerializer(many=True)