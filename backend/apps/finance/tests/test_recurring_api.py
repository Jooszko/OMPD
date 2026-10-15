from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from audit.models import AuditEntry
from finance.models import Expense, RecurringExpense
from finance.recurring import next_occurrence
from users.models import User

EXPENSES_URL = '/api/finance/expenses/'
URL = '/api/finance/recurring-expenses/'


def change_rows(entry):
    return [(c['label'], c['old'], c['new']) for c in entry.changes]


class RecurringExpenseApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = User.objects.create_user(username='admin_rapi', password='x', role='admin', full_name='Anna Admin')
        self.api.force_authenticate(self.admin)
        self.today = date.today()

    def template(self, **fields):
        data = {
            'category': 'rent', 'amount': Decimal('4500.00'), 'description': 'Czynsz', 'day_of_month': 1,
            'last_generated_on': self.today, 'created_by': self.admin,
        }
        return RecurringExpense.objects.create(**{**data, **fields})

    def test_expense_with_repeat_creates_template_covering_this_month(self):
        response = self.api.post(EXPENSES_URL, {
            'category': 'rent', 'amount': '4500', 'description': 'Czynsz', 'date': '2026-09-03',
            'repeat_monthly': True, 'day_of_month': 10,
        }, format='json')

        template = RecurringExpense.objects.get()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['recurring_id'], template.pk)
        self.assertEqual((template.day_of_month, template.last_generated_on), (10, date(2026, 9, 10)))
        self.assertEqual(Expense.objects.get().recurring, template)
        self.assertIn('10. dnia miesiąca', AuditEntry.objects.get(action='recurring.created').description)

    def test_repeat_defaults_to_the_expense_day(self):
        self.api.post(EXPENSES_URL, {
            'category': 'rent', 'amount': '4500', 'date': '2026-09-03', 'repeat_monthly': True,
        }, format='json')

        self.assertEqual(RecurringExpense.objects.get().day_of_month, 3)

    def test_invalid_payment_day_creates_nothing(self):
        for day in (0, 32, 'pierwszy'):
            with self.subTest(day=day):
                response = self.api.post(EXPENSES_URL, {
                    'category': 'rent', 'amount': '4500', 'date': '2026-09-03', 'repeat_monthly': True, 'day_of_month': day,
                }, format='json')
                self.assertEqual(response.status_code, 400)
        self.assertFalse(Expense.objects.exists())
        self.assertFalse(RecurringExpense.objects.exists())

    def test_list_shows_next_payment_and_monthly_total_of_active(self):
        rent = self.template()
        self.template(category='other', amount=Decimal('1250.00'), description='Leasing', day_of_month=15, is_active=False)

        data = self.api.get(URL).data

        self.assertEqual(data['monthly_total'], '4500.00')
        self.assertEqual([item['description'] for item in data['items']], ['Czynsz', 'Leasing'])
        expected_next = next_occurrence(1, self.today)
        self.assertEqual(data['items'][0]['next_date'], str(expected_next))
        self.assertEqual(data['items'][0]['days_until_next'], (expected_next - self.today).days)
        self.assertIsNone(data['items'][1]['next_date'])
        self.assertEqual(rent.pk, data['items'][0]['recurring_id'])

    def test_edit_is_logged_with_readable_values(self):
        rent = self.template()

        self.api.patch(f'{URL}{rent.pk}/', {'amount': '4700', 'day_of_month': 31}, format='json')

        entry = AuditEntry.objects.get(action='recurring.updated')
        self.assertEqual(change_rows(entry), [
            ('Kwota', '4500.00 zł', '4700.00 zł'),
            ('Dzień płatności', '1. dnia miesiąca', 'ostatniego dnia miesiąca'),
        ])

    def test_changing_payment_day_does_not_charge_twice_this_month(self):
        rent = self.template(day_of_month=1, last_generated_on=date(2026, 10, 1))

        self.api.patch(f'{URL}{rent.pk}/', {'day_of_month': 25}, format='json')

        rent.refresh_from_db()
        self.assertEqual(rent.last_generated_on, date(2026, 10, 25))

    def test_resuming_skips_months_missed_while_paused(self):
        rent = self.template(is_active=False, last_generated_on=self.today - timedelta(days=90))

        self.api.patch(f'{URL}{rent.pk}/', {'is_active': True}, format='json')
        self.api.get(URL)

        rent.refresh_from_db()
        self.assertTrue(rent.is_active)
        self.assertEqual(rent.last_generated_on, self.today)
        self.assertFalse(Expense.objects.exists())

    def test_rejects_invalid_edits(self):
        rent = self.template()
        for data in ({'day_of_month': 0}, {'is_active': 'tak'}, {'amount': '-5'}):
            with self.subTest(data=data):
                self.assertEqual(self.api.patch(f'{URL}{rent.pk}/', data, format='json').status_code, 400)

    def test_delete_keeps_already_added_expenses(self):
        rent = self.template()
        expense = Expense.objects.create(category='rent', amount=Decimal('4500.00'), date=self.today, recurring=rent)

        response = self.api.delete(f'{URL}{rent.pk}/')

        expense.refresh_from_db()
        self.assertEqual(response.status_code, 204)
        self.assertIsNone(expense.recurring)
        self.assertTrue(AuditEntry.objects.filter(action='recurring.deleted').exists())

    def test_only_admin_has_access(self):
        self.api.force_authenticate(User.objects.create_user(username='baker_rapi', password='x', role='baker', full_name='B'))

        self.assertEqual(self.api.get(URL).status_code, 403)