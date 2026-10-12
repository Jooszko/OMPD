from datetime import date, datetime
from decimal import Decimal

from django.db import models

from .models import AuditEntry


def _plain(value):
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, models.Model):
        return str(value)
    return value


def snapshot(instance, fields):
    return {field: _plain(getattr(instance, field)) for field in fields}


def field_changes(before, after, labels):
    return [
        {'field': field, 'label': label, 'old': before.get(field), 'new': after.get(field)}
        for field, label in labels.items()
        if before.get(field) != after.get(field)
    ]


def client_ip(request):
    return request.META.get('REMOTE_ADDR') if request is not None else None


def record_event(request, *, category, action, description, obj=None, object_label='', changes=None,
                 actor=None, actor_name=None):
    user = actor if actor is not None else getattr(request, 'user', None)
    if user is not None and not user.is_authenticated:
        user = None
    return AuditEntry.objects.create(
        actor=user,
        actor_name=actor_name if actor_name is not None else (user.full_name if user else ''),
        category=category,
        action=action,
        description=description,
        object_type=obj._meta.model_name if obj is not None else '',
        object_id=str(obj.pk) if obj is not None else '',
        object_label=object_label or (str(obj) if obj is not None else ''),
        changes=changes or [],
        ip_address=client_ip(request),
    )