from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User

STRONG_PASSWORD = 'Piekarnia-2026!'


class UserManagementPermissionTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = User.objects.create_user(
            username='admin_u', password=STRONG_PASSWORD, role='admin', full_name='Admin U'
        )
        self.driver = User.objects.create_user(
            username='driver_u', password=STRONG_PASSWORD, role='driver', full_name='Driver U'
        )

    def test_every_employee_can_list_users_for_messaging(self):
        self.api.force_authenticate(self.driver)
        self.assertEqual(self.api.get('/api/users/').status_code, 200)

    def test_non_admin_cannot_create_edit_or_delete_users(self):
        self.api.force_authenticate(self.driver)
        new_user = {'username': 'intruz_u', 'password': STRONG_PASSWORD, 'full_name': 'Intruz', 'role': 'admin'}

        self.assertEqual(self.api.post('/api/users/', new_user, format='json').status_code, 403)
        self.assertEqual(
            self.api.put(f'/api/users/{self.driver.pk}/', {'role': 'admin'}, format='json').status_code, 403
        )
        self.assertEqual(self.api.delete(f'/api/users/{self.admin.pk}/').status_code, 403)

        self.driver.refresh_from_db()
        self.assertEqual(self.driver.role, 'driver')
        self.assertTrue(User.objects.filter(pk=self.admin.pk).exists())
        self.assertFalse(User.objects.filter(username='intruz_u').exists())

    def test_admin_cannot_lock_themselves_out(self):
        self.api.force_authenticate(self.admin)
        url = f'/api/users/{self.admin.pk}/'

        self.assertEqual(self.api.put(url, {'role': 'driver'}, format='json').status_code, 400)
        self.assertEqual(self.api.put(url, {'is_active': False}, format='json').status_code, 400)
        self.assertEqual(self.api.delete(url).status_code, 400)

        self.admin.refresh_from_db()
        self.assertEqual((self.admin.role, self.admin.is_active), ('admin', True))

    def test_admin_manages_other_accounts(self):
        self.api.force_authenticate(self.admin)

        created = self.api.post(
            '/api/users/',
            {'username': 'baker_u', 'password': STRONG_PASSWORD, 'full_name': 'Baker U', 'role': 'baker'},
            format='json',
        )
        self.assertEqual(created.status_code, 201)
        self.assertNotIn('password', created.data)

        edited = self.api.put(
            f'/api/users/{self.driver.pk}/', {'full_name': 'Driver Nowy', 'password': ''}, format='json'
        )
        self.assertEqual(edited.status_code, 200)
        self.driver.refresh_from_db()
        self.assertEqual(self.driver.full_name, 'Driver Nowy')
        self.assertTrue(self.driver.check_password(STRONG_PASSWORD))


class PasswordValidationTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        admin = User.objects.create_user(username='admin_p', password=STRONG_PASSWORD, role='admin', full_name='Admin P')
        self.driver = User.objects.create_user(
            username='driver_p', password=STRONG_PASSWORD, role='driver', full_name='Driver P'
        )
        self.api.force_authenticate(admin)

    def test_weak_passwords_are_rejected_when_creating_account(self):
        for weak in ('abc', '12345678', 'password'):
            with self.subTest(weak):
                response = self.api.post(
                    '/api/users/',
                    {'username': 'nowy_p', 'password': weak, 'full_name': 'Nowy', 'role': 'baker'},
                    format='json',
                )
                self.assertEqual(response.status_code, 400)
                self.assertIn('password', response.data)
        self.assertFalse(User.objects.filter(username='nowy_p').exists())

    def test_weak_password_is_rejected_on_reset_and_old_one_stays(self):
        response = self.api.put(f'/api/users/{self.driver.pk}/', {'password': 'abc'}, format='json')

        self.assertEqual(response.status_code, 400)
        self.driver.refresh_from_db()
        self.assertTrue(self.driver.check_password(STRONG_PASSWORD))

    def test_strong_password_reset_is_hashed(self):
        response = self.api.put(f'/api/users/{self.driver.pk}/', {'password': 'Nowe-Haslo-77'}, format='json')

        self.assertEqual(response.status_code, 200)
        self.driver.refresh_from_db()
        self.assertTrue(self.driver.check_password('Nowe-Haslo-77'))
        self.assertNotEqual(self.driver.password, 'Nowe-Haslo-77')