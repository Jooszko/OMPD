from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from audit.models import AuditEntry
from clients.models import Client, Route
from finance.models import DailyFinancialReport, Expense
from orders.models import DailyOrder
from products.models import Product
from users.models import Notification, User

URL = '/api/finance/closings/'


class ClosingTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = User.objects.create_user(username='admin_cl', password='x', role='admin', full_name='Anna Admin')
        self.api.force_authenticate(self.admin)
        route = Route.objects.create(route_name='Trasa Cl')
        self.shop = Client.objects.create(name='Sklep Cl', address='Adres', route=route)
        self.bread = Product.objects.create(name='Chleb Cl', category='bread', base_price=Decimal('10.00'))
        self.today = date.today()
        self.yesterday = self.today - timedelta(days=1)
        DailyOrder.objects.create(
            client=self.shop, product=self.bread, order_date=self.yesterday, quantity=20,
            price_at_sale=Decimal('10.00'), status='delivered',
        )

    def close(self, day):
        return self.api.post(URL, {'date': str(day)}, format='json')

    def test_closing_freezes_the_day_and_is_logged(self):
        second_admin = User.objects.create_user(
            username='second_admin_cl', password='x', role='admin', full_name='Drugi administrator'
        )

        response = self.close(self.yesterday)

        report = DailyFinancialReport.objects.get(report_date=self.yesterday)
        self.assertEqual(response.status_code, 201)
        self.assertEqual((report.total_revenue, report.net_profit, report.generated_by), (Decimal('200.00'), Decimal('200.00'), self.admin))
        self.assertEqual(response.data['closed']['closed_by'], 'Anna Admin')
        notifications = Notification.objects.order_by('user_id')
        self.assertEqual(set(notifications.values_list('user_id', flat=True)), {self.admin.pk, second_admin.pk})
        self.assertEqual(set(notifications.values_list('title', flat=True)), {'Zamknięto dzień'})
        self.assertEqual(
            set(notifications.values_list('message', flat=True)),
            {f'Zamknięto dzień {self.yesterday:%d.%m.%Y}.'},
        )
        self.assertTrue(all(notification.sender_id == self.admin.pk for notification in notifications))
        entry = AuditEntry.objects.get(action='report.closed')
        self.assertIn(('Zysk netto', None, '200.00'), [(c['label'], c['old'], c['new']) for c in entry.changes])

    def test_change_after_closing_shows_drift_but_keeps_frozen_numbers(self):
        self.close(self.yesterday)
        Expense.objects.create(category='fuel', amount=Decimal('50.00'), date=self.yesterday)

        day = self.api.get(URL).data[1]

        self.assertEqual(day['date'], str(self.yesterday))
        self.assertEqual(day['net_profit'], '150.00')
        self.assertEqual(day['closed']['net_profit'], '200.00')
        self.assertEqual(day['drift'], '-50.00')

    def test_list_shows_last_14_days_newest_first_with_open_days(self):
        data = self.api.get(URL).data

        self.assertEqual(len(data), 14)
        self.assertEqual(data[0]['date'], str(self.today))
        self.assertIsNone(data[0]['closed'])
        self.assertIsNone(data[0]['drift'])

    def test_cannot_close_twice_or_the_future(self):
        self.close(self.yesterday)

        self.assertEqual(self.close(self.yesterday).status_code, 400)
        self.assertEqual(self.close(self.today + timedelta(days=1)).status_code, 400)
        self.assertEqual(self.api.post(URL, {'date': 'wczoraj'}, format='json').status_code, 400)
        self.assertEqual(DailyFinancialReport.objects.count(), 1)

    def test_reopening_removes_snapshot_and_keeps_values_in_log(self):
        self.close(self.yesterday)

        response = self.api.delete(f'{URL}{self.yesterday}/')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(DailyFinancialReport.objects.exists())
        self.assertEqual(Notification.objects.count(), 1)
        entry = AuditEntry.objects.get(action='report.reopened')
        self.assertIn(('Zysk netto', '200.00', None), [(c['label'], c['old'], c['new']) for c in entry.changes])
        self.assertEqual(self.api.delete(f'{URL}{self.yesterday}/').status_code, 404)

    def test_invalid_closing_does_not_notify_admins(self):
        self.assertEqual(self.close(self.today + timedelta(days=1)).status_code, 400)
        self.assertFalse(Notification.objects.exists())

    def test_rejects_too_long_or_future_ranges(self):
        far = self.today - timedelta(days=200)
        self.assertEqual(self.api.get(URL, {'start': str(far), 'end': str(self.today)}).status_code, 400)
        self.assertEqual(self.api.get(URL, {'end': str(self.today + timedelta(days=3))}).status_code, 400)

    def test_only_admin_has_access(self):
        self.api.force_authenticate(User.objects.create_user(username='baker_cl', password='x', role='baker', full_name='B'))

        self.assertEqual(self.api.get(URL).status_code, 403)
        self.assertEqual(self.close(self.yesterday).status_code, 403)