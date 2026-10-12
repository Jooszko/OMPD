from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db.models import Q
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import User
from users.permissions import AdminOnly

from .labels import ACTIONS
from .models import AuditEntry
from .serializers import AuditEntrySerializer

LOCAL_TZ = ZoneInfo('Europe/Warsaw')


def _day_start(day):
    return datetime.combine(day, time.min, tzinfo=LOCAL_TZ)


class AuditPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


def _parse_date(params, name):
    raw = params.get(name)
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError:
        raise ValidationError({name: 'Nieprawidłowy format daty (RRRR-MM-DD).'})


def filter_entries(params):
    entries = AuditEntry.objects.all()

    category = params.get('category')
    if category:
        if category not in dict(AuditEntry.CATEGORY_CHOICES):
            raise ValidationError({'category': 'Nieznana kategoria.'})
        entries = entries.filter(category=category)

    action = params.get('action')
    if action:
        entries = entries.filter(action=action)

    actor = params.get('actor')
    if actor:
        if not actor.isdigit():
            raise ValidationError({'actor': 'Nieprawidłowy identyfikator użytkownika.'})
        entries = entries.filter(actor_id=int(actor))

    object_type = params.get('object_type')
    if object_type:
        entries = entries.filter(object_type=object_type)
    object_id = params.get('object_id')
    if object_id:
        entries = entries.filter(object_id=object_id)

    query = params.get('q', '').strip()
    if query:
        entries = entries.filter(
            Q(description__icontains=query) | Q(object_label__icontains=query) | Q(actor_name__icontains=query)
        )

    date_from = _parse_date(params, 'date_from')
    date_to = _parse_date(params, 'date_to')
    if date_from and date_to and date_from > date_to:
        raise ValidationError({'date_to': 'Data końcowa nie może być wcześniejsza niż początkowa.'})
    if date_from:
        entries = entries.filter(created_at__gte=_day_start(date_from))
    if date_to:
        entries = entries.filter(created_at__lt=_day_start(date_to + timedelta(days=1)))

    return entries


class AuditEntryListView(APIView):
    permission_classes = [AdminOnly]

    def get(self, request):
        entries = filter_entries(request.query_params)
        paginator = AuditPagination()
        page = paginator.paginate_queryset(entries, request, view=self)
        return paginator.get_paginated_response(AuditEntrySerializer(page, many=True).data)


class AuditFiltersView(APIView):
    permission_classes = [AdminOnly]

    def get(self, request):
        actors = User.objects.filter(audit_entries__isnull=False).distinct().order_by('full_name')
        return Response({
            'categories': [{'value': value, 'label': label} for value, label in AuditEntry.CATEGORY_CHOICES],
            'actions': [
                {'value': code, 'label': label, 'category': category}
                for category, actions in ACTIONS.items()
                for code, label in actions.items()
            ],
            'actors': [{'id': user.user_id, 'name': user.full_name} for user in actors],
        })