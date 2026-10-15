from datetime import datetime, timedelta, timezone as dt_timezone

from django.test import TestCase
from django.utils import timezone

from users.models import Notification, User
from dashboard.seed.users import SEED_USERNAMES, create_notifications, create_users, seed_last_login


class CreateUsersTests(TestCase):
    def test_creates_twenty_users_split_by_role(self):
        users = create_users()

        self.assertEqual(len(users['admins']), 2)
        self.assertEqual(len(users['bakers']), 12)
        self.assertEqual(len(users['drivers']), 6)
        self.assertEqual(User.objects.count(), 20)
        self.assertEqual(len(SEED_USERNAMES), 20)

    def test_is_idempotent(self):
        create_users()
        create_users()

        self.assertEqual(User.objects.count(), 20)

    def test_inactive_user_present(self):
        create_users()

        inactive = User.objects.filter(is_active=False)
        self.assertEqual(inactive.count(), 1)
        self.assertEqual(inactive.first().username, 'kowalski_test')

    def test_every_user_has_a_past_last_login(self):
        create_users()

        now = timezone.now()
        for user in User.objects.all():
            self.assertIsNotNone(user.last_login)
            self.assertLessEqual(user.last_login, now)

    def test_last_login_is_never_in_the_future_early_in_the_morning(self):
        night = datetime(2026, 10, 15, 0, 30, tzinfo=dt_timezone.utc)

        moment = seed_last_login('admin', 0, True, now=night)

        self.assertLess(moment, night)
        self.assertGreater(moment, night - timedelta(days=2))

class CreateNotificationsTests(TestCase):
    def test_creates_three_notifications_per_user(self):
        users = create_users()

        created_count = create_notifications(users)

        self.assertEqual(created_count, 60)
        self.assertEqual(Notification.objects.count(), 60)
        for user in User.objects.all():
            self.assertEqual(Notification.objects.filter(user=user).count(), 3)
