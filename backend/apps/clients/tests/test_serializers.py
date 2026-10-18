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
        
    def test_sent_coordinates_record_when_they_were_set(self):
        serializer = ClientSerializer(
            self.client_obj,
            data={'address': 'Inny adres 5', 'latitude': '50.1', 'longitude': '19.2'},
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

        self.assertIsNotNone(serializer.save().geocoded_at)

    def test_new_client_with_coordinates_gets_geocoded_at(self):
        serializer = ClientSerializer(
            data={'name': 'Nowy', 'address': 'Rynek 2', 'route': self.route.pk, 'latitude': '50.1', 'longitude': '19.2'}
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

        self.assertIsNotNone(serializer.save().geocoded_at)


    def test_geocoded_at_is_read_only(self):
        serializer = ClientSerializer(
            self.client_obj,
            data={'geocoded_at': '2020-01-01T00:00:00Z'},
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertNotIn('geocoded_at', serializer.validated_data)

class ClientSerializerPhoneTests(TestCase):
    def setUp(self):
        self.route = Route.objects.create(route_name='Trasa Tel')
        self.client_obj = Client.objects.create(name='Klient Tel', address='Rynek 2, Skoczów', route=self.route)

    def save_phone(self, phone):
        serializer = ClientSerializer(self.client_obj, data={'phone': phone}, partial=True)
        return serializer, serializer.is_valid()

    def test_phone_is_normalized(self):
        serializer, valid = self.save_phone('+48 600-100 (200)')
        self.assertTrue(valid, serializer.errors)
        self.assertEqual(serializer.save().phone, '+48600100200')

    def test_local_nine_digit_phone_is_accepted(self):
        serializer, valid = self.save_phone('600 100 200')
        self.assertTrue(valid, serializer.errors)
        self.assertEqual(serializer.save().phone, '600100200')

    def test_blank_phone_is_allowed(self):
        serializer, valid = self.save_phone('')
        self.assertTrue(valid, serializer.errors)
        self.assertEqual(serializer.save().phone, '')

    def test_invalid_phone_is_rejected(self):
        for phone in ('abc', '12345', '600 100 20a', '+48 600 100 200 300 400'):
            with self.subTest(phone=phone):
                serializer, valid = self.save_phone(phone)
                self.assertFalse(valid)
                self.assertIn('phone', serializer.errors)