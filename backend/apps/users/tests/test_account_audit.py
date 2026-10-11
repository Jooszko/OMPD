from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from audit.models import AuditEntry
from users.models import User
from users.views import MAX_LOGIN_FAILURES

PASSWORD = 'Piekarnia-2026!'
NEW_PASSWORD = 'Nowe-Haslo-77'


def entry_text(entry):
    return f'{entry.description} {entry.changes} {entry.object_label} {entry.actor_name}'


class AccountAuditTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = User.objects.create_user(username='admin_au', password=PASSWORD, role='admin', full_name='Anna Admin')
        self.driver = User.objects.create_user(
            username='driver_au', password=PASSWORD, role='driver', full_name='Jan Kierowca'
        )
        self.api.force_authenticate(self.admin)

    def test_creating_account_is_recorded_without_the_password(self):
        self.api.post(
            '/api/users/',
            {'username': 'nowy_au', 'password': PASSWORD, 'full_name': 'Ola Nowa', 'role': 'baker'},
            format='json',
        )

        entry = AuditEntry.objects.get(action='user.created')
        self.assertEqual(entry.actor, self.admin)
        self.assertIn('Ola Nowa', entry.description)
        self.assertIn('Piekarz', entry.description)
        self.assertNotIn(PASSWORD, entry_text(entry))

    def test_editing_records_only_changed_fields(self):
        self.api.put(
            f'/api/users/{self.driver.pk}/',
            {'full_name': 'Jan Nowak', 'role': 'baker', 'username': 'driver_au'},
            format='json',
        )

        entry = AuditEntry.objects.get(action='user.updated')
        self.assertEqual(
            [(c['label'], c['old'], c['new']) for c in entry.changes],
            [('Imię i nazwisko', 'Jan Kierowca', 'Jan Nowak'), ('Rola', 'Kierowca', 'Piekarz')],
        )

    def test_password_reset_is_its_own_entry_without_the_password(self):
        self.api.put(f'/api/users/{self.driver.pk}/', {'password': NEW_PASSWORD}, format='json')

        entry = AuditEntry.objects.get(action='user.password_reset')
        self.assertFalse(AuditEntry.objects.filter(action='user.updated').exists())
        self.assertNotIn(NEW_PASSWORD, entry_text(entry))

    def test_rejected_edit_leaves_no_entry(self):
        response = self.api.put(f'/api/users/{self.driver.pk}/', {'password': 'abc'}, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertFalse(AuditEntry.objects.exists())

    def test_deleted_account_stays_named_in_the_log(self):
        driver_id = self.driver.pk
        self.api.delete(f'/api/users/{driver_id}/')

        entry = AuditEntry.objects.get(action='user.deleted')
        self.assertEqual((entry.object_id, entry.object_label), (str(driver_id), 'Jan Kierowca'))


class LoginAuditTests(TestCase):
    def setUp(self):
        cache.clear()
        self.api = APIClient()
        self.driver = User.objects.create_user(
            username='driver_lg', password=PASSWORD, role='driver', full_name='Jan Kierowca'
        )

    def login(self, password, username='driver_lg'):
        return self.api.post('/api/auth/login/', {'username': username, 'password': password}, format='json')

    def test_successful_login_names_the_employee(self):
        self.login(PASSWORD)

        entry = AuditEntry.objects.get(action='login.succeeded')
        self.assertEqual((entry.actor, entry.actor_name), (self.driver, 'Jan Kierowca'))

    def test_failed_login_records_attempted_login_but_no_actor(self):
        self.login('zle-haslo')

        entry = AuditEntry.objects.get(action='login.failed')
        self.assertIsNone(entry.actor)
        self.assertEqual(entry.actor_name, 'driver_lg')
        self.assertEqual(entry.object_id, str(self.driver.pk))
        self.assertIn('próba 1 z', entry.description)
        self.assertNotIn('zle-haslo', entry_text(entry))

    def test_lockout_is_recorded_once(self):
        for _ in range(MAX_LOGIN_FAILURES + 2):
            self.login('zle-haslo')

        self.assertEqual(AuditEntry.objects.filter(action='login.failed').count(), MAX_LOGIN_FAILURES)
        self.assertEqual(AuditEntry.objects.filter(action='login.locked').count(), 1)

    def test_unknown_login_is_recorded_by_name(self):
        self.login('cokolwiek', username='nieistniejacy')

        entry = AuditEntry.objects.get(action='login.failed')
        self.assertEqual((entry.object_id, entry.object_label), ('', 'nieistniejacy'))

    def test_inactive_account_attempt_is_recorded(self):
        self.driver.is_active = False
        self.driver.save()

        self.login(PASSWORD)

        self.assertTrue(AuditEntry.objects.filter(action='login.inactive_account').exists())

    def test_setting_own_password_is_recorded(self):
        self.driver.must_change_password = True
        self.driver.save()
        access = self.login(PASSWORD).data['access']
        self.api.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')

        self.api.post('/api/auth/change-password/', {'new_password': NEW_PASSWORD}, format='json')

        entry = AuditEntry.objects.get(action='password.initial_set')
        self.assertEqual(entry.actor, self.driver)
        self.assertNotIn(NEW_PASSWORD, entry_text(entry))