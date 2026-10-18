from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from audit.services import field_changes, record_event, snapshot
from users.permissions import AdminOnly, role_permission
from .models import Client, Route
from .serializers import ClientSerializer, RouteSerializer
from .services.card import client_card
from .services.geocoding import GeocodingError, lookup_address, wait_for_turn

CLIENT_AUDIT_LABELS = {
    'name': 'Nazwa',
    'address': 'Adres',
    'nip': 'NIP',
    'phone': 'Telefon',
    'route': 'Trasa',
    'is_active': 'Aktywny',
}


class RouteListView(APIView):
    permission_classes = [AdminOnly]
    def get(self, request):
        routes = Route.objects.filter(is_active=True).select_related('driver').order_by('route_name')
        serializer = RouteSerializer(routes, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ClientListCreateView(APIView):
    permission_classes = [role_permission('admin', read=('admin', 'baker'))]
    def get(self, request):
        clients = Client.objects.select_related('route__driver').prefetch_related('standing_orders').order_by('name')
        serializer = ClientSerializer(clients, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = ClientSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            client = serializer.save()
            record_event(
                request, category='clients', action='client.created', obj=client,
                description=f'Dodano klienta {client.name} (trasa {client.route}).',
            )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ClientDetailView(APIView):
    permission_classes = [AdminOnly]

    def get(self, request, pk):
        client = get_object_or_404(Client.objects.select_related('route__driver'), pk=pk)
        return Response({**ClientSerializer(client).data, **client_card(client, timezone.localdate())})

    def put(self, request, pk):
        client = get_object_or_404(Client.objects.select_related('route'), pk=pk)
        serializer = ClientSerializer(client, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        before = snapshot(client, CLIENT_AUDIT_LABELS)
        with transaction.atomic():
            client = serializer.save()
            changes = field_changes(before, snapshot(client, CLIENT_AUDIT_LABELS), CLIENT_AUDIT_LABELS)
            if changes:
                record_event(
                    request, category='clients', action='client.updated', obj=client,
                    description=f'Zmieniono dane klienta {client.name}.', changes=changes,
                )
        return Response(serializer.data, status=status.HTTP_200_OK)


GEOCODING_ERRORS = {
    'empty': ('Podaj adres do sprawdzenia.', status.HTTP_400_BAD_REQUEST),
    'not_found': ('Nie znaleziono tego adresu na mapie. Sprawdź ulicę i miejscowość.', status.HTTP_404_NOT_FOUND),
    'unavailable': ('Serwis map nie odpowiada. Spróbuj ponownie za chwilę.', status.HTTP_503_SERVICE_UNAVAILABLE),
}


def _geocoding_error(code):
    message, http_status = GEOCODING_ERRORS[code]
    return Response({'error': message, 'code': code}, status=http_status)


def _lookup(address):
    if not address.strip():
        return None, _geocoding_error('empty')
    wait_for_turn()
    try:
        match = lookup_address(address)
    except GeocodingError:
        return None, _geocoding_error('unavailable')
    if match is None:
        return None, _geocoding_error('not_found')
    return match, None


class GeocodePreviewView(APIView):
    permission_classes = [AdminOnly]

    def post(self, request):
        match, error = _lookup(str(request.data.get('address') or ''))
        if error:
            return error
        return Response({'latitude': str(match.latitude), 'longitude': str(match.longitude), 'label': match.label})


class ClientGeocodeView(APIView):
    permission_classes = [AdminOnly]

    def post(self, request, pk):
        client = get_object_or_404(Client.objects.select_related('route__driver'), pk=pk)
        match, error = _lookup(client.address)
        if error:
            return error
        with transaction.atomic():
            client.latitude = match.latitude
            client.longitude = match.longitude
            client.geocoded_at = timezone.now()
            client.save(update_fields=['latitude', 'longitude', 'geocoded_at'])
            record_event(
                request, category='clients', action='client.geocoded', obj=client,
                description=f'Ustalono lokalizację klienta {client.name} z adresu {client.address}.',
            )
        return Response(ClientSerializer(client).data)