from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from audit.models import AuditEntry
from finance.models import Expense
from users.models import User

URL = '/api/finance/expenses/'


def change_rows(entry):
    return [(c['label'], c['old'], c['new']) for c in entry.changes]


class ExpenseApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = User.objects.create_user(username='admin_exp', password='x', role='admin', full_name='Anna Admin')
        self.api.force_authenticate(self.admin)

    def expense(self, **fields):
        data = {'category': 'fuel', 'amount': Decimal('100.00'), 'description': 'Tankowanie', 'date': date(2026, 9, 10)}
        return Expense.objects.create(created_by=self.admin, **{**data, **fields})

    def test_create_returns_expense_with_author(self):
        response = self.api.post(
            URL, {'category': 'rent', 'amount': '4500,5', 'description': '  Czynsz  ', 'date': '2026-09-01'}, format='json'
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['amount'], '4500.50')
        self.assertEqual(response.data['description'], 'Czynsz')
        self.assertEqual(response.data['created_by'], 'Anna Admin')

    def test_create_rejects_invalid_values(self):
        tomorrow = str(date.today() + timedelta(days=1))
        for data in (
            {'category': 'pizza', 'amount': '10', 'date': '2026-09-01'},
            {'category': 'fuel', 'amount': '0', 'date': '2026-09-01'},
            {'category': 'fuel', 'amount': '-5', 'date': '2026-09-01'},
            {'category': 'fuel', 'amount': 'dużo', 'date': '2026-09-01'},
            {'category': 'fuel', 'amount': '10', 'date': '01.09.2026'},
            {'category': 'fuel', 'amount': '10', 'date': tomorrow},
            {'category': 'fuel', 'amount': '10', 'date': '2026-09-01', 'description': 'x' * 256},
        ):
            with self.subTest(data=data):
                response = self.api.post(URL, data, format='json')
                self.assertEqual(response.status_code, 400)
                self.assertIn('error', response.data)
        self.assertFalse(Expense.objects.exists())

    def test_list_returns_period_newest_first(self):
        old = self.expense(date=date(2026, 9, 1))
        new = self.expense(date=date(2026, 9, 5))
        self.expense(date=date(2026, 8, 20))

        response = self.api.get(URL, {'start': '2026-09-01', 'end': '2026-09-10'})

        self.assertEqual([e['expense_id'] for e in response.data], [new.pk, old.pk])
        self.assertEqual(self.api.get(URL, {'start': '2026-09-10', 'end': '2026-09-01'}).status_code, 400)

    def test_edit_changes_only_sent_fields_and_logs_them(self):
        expense = self.expense()

        response = self.api.patch(f'{URL}{expense.pk}/', {'amount': '120', 'description': 'Tankowanie Ducato'}, format='json')

        expense.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual((expense.amount, expense.category), (Decimal('120.00'), 'fuel'))
        entry = AuditEntry.objects.get(action='expense.updated')
        self.assertEqual(change_rows(entry), [
            ('Kwota', '100.00 zł', '120.00 zł'),
            ('Opis', 'Tankowanie', 'Tankowanie Ducato'),
        ])

    def test_edit_without_changes_is_not_logged(self):
        expense = self.expense()

        self.api.patch(f'{URL}{expense.pk}/', {'amount': '100.00'}, format='json')

        self.assertFalse(AuditEntry.objects.filter(action='expense.updated').exists())

    def test_invalid_edit_leaves_expense_untouched(self):
        expense = self.expense()

        response = self.api.patch(f'{URL}{expense.pk}/', {'amount': '-1'}, format='json')

        expense.refresh_from_db()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(expense.amount, Decimal('100.00'))

    def test_delete_removes_expense_and_keeps_values_in_log(self):
        expense = self.expense()

        response = self.api.delete(f'{URL}{expense.pk}/')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Expense.objects.exists())
        entry = AuditEntry.objects.get(action='expense.deleted')
        self.assertIn(('Kwota', '100.00 zł', None), change_rows(entry))
        self.assertIn('Paliwo', entry.description)

    def test_only_admin_can_edit_or_delete(self):
        expense = self.expense()
        self.api.force_authenticate(User.objects.create_user(username='baker_exp', password='x', role='baker', full_name='B'))

        self.assertEqual(self.api.patch(f'{URL}{expense.pk}/', {'amount': '1'}, format='json').status_code, 403)
        self.assertEqual(self.api.delete(f'{URL}{expense.pk}/').status_code, 403)
        self.assertTrue(Expense.objects.filter(pk=expense.pk).exists())