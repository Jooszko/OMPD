from django.test import TestCase

from users.models import Notification, User
from dashboard.seed.users import SEED_USERNAMES, create_notifications, create_users


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


class CreateNotificationsTests(TestCase):
    def test_creates_three_notifications_per_user(self):
        users = create_users()

        created_count = create_notifications(users)

        self.assertEqual(created_count, 60)
        self.assertEqual(Notification.objects.count(), 60)
        for user in User.objects.all():
            self.assertEqual(Notification.objects.filter(user=user).count(), 3)
