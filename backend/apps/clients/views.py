from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from audit.services import field_changes, record_event, snapshot
from users.permissions import AdminOnly, role_permission
from .models import Client, Route
from .serializers import ClientSerializer, RouteSerializer

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
        routes = Route.objects.filter(is_active=True).order_by('route_name')
        serializer = RouteSerializer(routes, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ClientListCreateView(APIView):
    permission_classes = [role_permission('admin', read=('admin', 'baker'))]
    def get(self, request):
        clients = Client.objects.select_related('route').order_by('name')
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