from decimal import Decimal

from django.test import TestCase

from clients.models import Client, Route
from clients.serializers import ClientSerializer


class ClientSerializerCoordinatesTests(TestCase):
    def setUp(self):
        self.route = Route.objects.create(route_name='Trasa Test')
        self.client_obj = Client.objects.create(
            name='Klient Test',
            address='Rynek 1, Skoczów',
            route=self.route,
            latitude=Decimal('49.798'),
            longitude=Decimal('18.783'),
        )

    def test_latitude_longitude_are_exposed(self):
        data = ClientSerializer(self.client_obj).data
        self.assertEqual(data['latitude'], '49.798000')
        self.assertEqual(data['longitude'], '18.783000')
        self.assertIn('geocoded_at', data)

    def test_address_change_without_coords_clears_them(self):
        serializer = ClientSerializer(
            self.client_obj,
            data={'address': 'Inny adres 5'},
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        instance = serializer.save()

        self.assertIsNone(instance.latitude)
        self.assertIsNone(instance.longitude)
        self.assertIsNone(instance.geocoded_at)

    def test_address_change_with_explicit_coords_keeps_them(self):
        serializer = ClientSerializer(
            self.client_obj,
            data={'address': 'Inny adres 5', 'latitude': '50.1', 'longitude': '19.2'},
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        instance = serializer.save()

        self.assertEqual(instance.latitude, Decimal('50.100000'))
        self.assertEqual(instance.longitude, Decimal('19.200000'))

    def test_unrelated_field_update_keeps_coords(self):
        serializer = ClientSerializer(
            self.client_obj,
            data={'is_active': False},
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        instance = serializer.save()

        self.assertEqual(instance.latitude, Decimal('49.798000'))
        self.assertEqual(instance.longitude, Decimal('18.783000'))

    def test_geocoded_at_is_read_only(self):
        serializer = ClientSerializer(
            self.client_obj,
            data={'geocoded_at': '2020-01-01T00:00:00Z'},
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertNotIn('geocoded_at', serializer.validated_data)
