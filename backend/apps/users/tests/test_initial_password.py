from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User

TEMP_PASSWORD = 'Tymczasowe-2026!'
NEW_PASSWORD = 'Moje-Wlasne-77'


class InitialPasswordTests(TestCase):
    def setUp(self):
        cache.clear()
        self.api = APIClient()
        self.admin = User.objects.create_user(
            username='admin_i', password='Piekarnia-2026!', role='admin', full_name='Admin I'
        )
        self.api.force_authenticate(self.admin)
        response = self.api.post(
            '/api/users/',
            {'username': 'kierowca_i', 'password': TEMP_PASSWORD, 'full_name': 'Kierowca I', 'role': 'driver'},
            format='json',
        )
        self.api.force_authenticate(None)
        self.employee = User.objects.get(pk=response.data['user_id'])

    def login(self, password=TEMP_PASSWORD):
        return self.api.post('/api/auth/login/', {'username': 'kierowca_i', 'password': password}, format='json')

    def use_token(self, access):
        self.api.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')

    def change(self, new_password):
        return self.api.post('/api/auth/change-password/', {'new_password': new_password}, format='json')

    def test_account_created_by_admin_requires_password_change(self):
        response = self.login()

        self.assertTrue(self.employee.must_change_password)
        self.assertTrue(response.data['must_change_password'])

    def test_only_password_change_flow_is_reachable_before_change(self):
        self.use_token(self.login().data['access'])

        blocked = self.api.get('/api/logistics/')
        me = self.api.get('/api/users/me/')

        self.assertEqual(blocked.status_code, 403)
        self.assertEqual(blocked.data['code'], 'password_change_required')
        self.assertEqual(me.status_code, 200)
        self.assertTrue(me.data['must_change_password'])

    def test_new_password_must_differ_and_be_strong(self):
        self.use_token(self.login().data['access'])

        for password in (TEMP_PASSWORD, 'abc', '12345678'):
            with self.subTest(password):
                response = self.change(password)
                self.assertEqual(response.status_code, 400)
                self.assertIn('new_password', response.data)

    def test_changing_password_unlocks_api_and_replaces_tokens(self):
        first_login = self.login().data
        self.use_token(first_login['access'])

        response = self.change(NEW_PASSWORD)

        self.assertEqual(response.status_code, 200)
        self.employee.refresh_from_db()
        self.assertFalse(self.employee.must_change_password)
        self.assertTrue(self.employee.check_password(NEW_PASSWORD))

        old_refresh = self.api.post('/api/auth/refresh/', {'refresh': first_login['refresh']}, format='json')
        self.assertEqual(old_refresh.status_code, 401)

        self.use_token(response.data['access'])
        self.assertEqual(self.api.get('/api/logistics/').status_code, 200)

    def test_employee_cannot_change_password_on_their_own_later(self):
        self.use_token(self.login().data['access'])
        self.change(NEW_PASSWORD)
        self.use_token(self.login(NEW_PASSWORD).data['access'])

        response = self.change('Kolejne-Haslo-88')

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['code'], 'not_required')

    def test_admin_reset_requires_change_again(self):
        self.employee.must_change_password = False
        self.employee.save()

        self.api.force_authenticate(self.admin)
        self.api.put(f'/api/users/{self.employee.pk}/', {'password': 'Nowe-Tymczasowe-9'}, format='json')

        self.employee.refresh_from_db()
        self.assertTrue(self.employee.must_change_password)