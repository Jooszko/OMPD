from unittest import mock

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from users.models import User
from users.views import MAX_LOGIN_FAILURES

PASSWORD = 'Piekarnia-2026!'
LOGIN_URL = '/api/auth/login/'


class LoginViewTests(TestCase):
    def setUp(self):
        cache.clear()
        self.api = APIClient()
        self.user = User.objects.create_user(
            username='kierowca_l', password=PASSWORD, role='driver', full_name='Kierowca L'
        )

    def login(self, password, username='kierowca_l'):
        return self.api.post(LOGIN_URL, {'username': username, 'password': password}, format='json')

    def test_correct_credentials_return_tokens(self):
        response = self.login(PASSWORD)

        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_wrong_password_returns_clear_error(self):
        response = self.login('zle-haslo')

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data['code'], 'invalid_credentials')

    def test_account_is_locked_after_too_many_failures(self):
        for _ in range(MAX_LOGIN_FAILURES):
            self.assertEqual(self.login('zle-haslo').status_code, 401)

        response = self.login(PASSWORD)

        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.data['code'], 'too_many_attempts')

    def test_successful_login_resets_failure_counter(self):
        for _ in range(MAX_LOGIN_FAILURES - 1):
            self.login('zle-haslo')
        self.assertEqual(self.login(PASSWORD).status_code, 200)

        for _ in range(MAX_LOGIN_FAILURES - 1):
            self.assertEqual(self.login('zle-haslo').status_code, 401)

    def test_lockout_applies_only_to_that_username(self):
        User.objects.create_user(username='piekarz_l', password=PASSWORD, role='baker', full_name='Piekarz L')
        for _ in range(MAX_LOGIN_FAILURES):
            self.login('zle-haslo')

        self.assertEqual(self.login(PASSWORD, username='piekarz_l').status_code, 200)

    def test_inactive_account_is_reported_only_with_correct_password(self):
        self.user.is_active = False
        self.user.save()

        with_correct = self.login(PASSWORD)
        with_wrong = self.login('zle-haslo')

        self.assertEqual((with_correct.status_code, with_correct.data['code']), (403, 'account_inactive'))
        self.assertEqual((with_wrong.status_code, with_wrong.data['code']), (401, 'invalid_credentials'))

    def test_ip_limit_stops_guessing_across_many_usernames(self):
        with mock.patch.object(ScopedRateThrottle, 'THROTTLE_RATES', {'login': '3/min'}):
            statuses = [self.login('zle-haslo', username=f'konto{i}').status_code for i in range(4)]

        self.assertEqual(statuses, [401, 401, 401, 429])