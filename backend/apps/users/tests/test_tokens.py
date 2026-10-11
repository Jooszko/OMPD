import time

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from users.models import User

PASSWORD = 'Piekarnia-2026!'


class TokenLifecycleTests(TestCase):
    def setUp(self):
        cache.clear()
        self.api = APIClient()
        self.admin = User.objects.create_user(username='admin_t', password=PASSWORD, role='admin', full_name='Admin T')
        self.driver = User.objects.create_user(
            username='driver_t', password=PASSWORD, role='driver', full_name='Driver T'
        )

    def login(self):
        return self.api.post('/api/auth/login/', {'username': 'driver_t', 'password': PASSWORD}, format='json').data

    def refresh(self, refresh_token):
        return self.api.post('/api/auth/refresh/', {'refresh': refresh_token}, format='json')

    def edit_driver_as_admin(self, data):
        self.api.force_authenticate(self.admin)
        response = self.api.put(f'/api/users/{self.driver.pk}/', data, format='json')
        self.api.force_authenticate(None)
        return response

    def test_access_token_lives_thirty_minutes(self):
        access = AccessToken(self.login()['access'])

        self.assertAlmostEqual(access['exp'] - time.time(), 30 * 60, delta=60)

    def test_refresh_rotates_and_old_token_stops_working(self):
        old = self.login()['refresh']

        first = self.refresh(old)

        self.assertEqual(first.status_code, 200)
        self.assertNotEqual(first.data['refresh'], old)
        self.assertEqual(self.refresh(old).status_code, 401)
        self.assertEqual(self.refresh(first.data['refresh']).status_code, 200)

    def test_logout_revokes_refresh_token(self):
        refresh = self.login()['refresh']

        logout = self.api.post('/api/auth/logout/', {'refresh': refresh}, format='json')

        self.assertEqual(logout.status_code, 200)
        self.assertEqual(self.refresh(refresh).status_code, 401)

    def test_password_reset_by_admin_ends_existing_sessions(self):
        refresh = self.login()['refresh']

        self.assertEqual(self.edit_driver_as_admin({'password': 'Nowe-Haslo-77'}).status_code, 200)

        self.assertEqual(self.refresh(refresh).status_code, 401)

    def test_deactivation_ends_existing_sessions(self):
        refresh = self.login()['refresh']

        self.assertEqual(self.edit_driver_as_admin({'is_active': False}).status_code, 200)

        self.assertEqual(self.refresh(refresh).status_code, 401)

    def test_editing_other_fields_keeps_sessions(self):
        refresh = self.login()['refresh']

        self.assertEqual(self.edit_driver_as_admin({'full_name': 'Driver Nowy'}).status_code, 200)

        self.assertEqual(self.refresh(refresh).status_code, 200)