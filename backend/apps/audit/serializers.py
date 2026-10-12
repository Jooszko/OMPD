from rest_framework import serializers

from .labels import ACTION_LABELS
from .models import AuditEntry


class AuditEntrySerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source='get_category_display', read_only=True)
    action_label = serializers.SerializerMethodField()

    class Meta:
        model = AuditEntry
        fields = [
            'entry_id', 'created_at', 'actor', 'actor_name', 'category', 'category_label',
            'action', 'action_label', 'object_type', 'object_id', 'object_label',
            'description', 'changes', 'ip_address',
        ]

    def get_action_label(self, entry):
        return ACTION_LABELS.get(entry.action, entry.action)