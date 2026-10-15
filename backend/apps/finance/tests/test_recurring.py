from datetime import date, timedelta
from decimal import Decimal
from io import StringIO

from django.core.management import call_command
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from audit.models import AuditEntry
from finance.models import Expense, RecurringExpense
from finance.recurring import materialize_due_expenses, next_occurrence, occurrence_in_month
from users.models import User


class PaymentDayTests(SimpleTestCase):
    def test_day_31_means_last_day_of_shorter_months(self):
        self.assertEqual(occurrence_in_month(2026, 2, 31), date(2026, 2, 28))
        self.assertEqual(occurrence_in_month(2028, 2, 30), date(2028, 2, 29))
        self.assertEqual(occurrence_in_month(2026, 4, 31), date(2026, 4, 30))

    def test_next_occurrence_is_strictly_after_the_given_day(self):
        self.assertEqual(next_occurrence(20, date(2026, 10, 13)), date(2026, 10, 20))
        self.assertEqual(next_occurrence(1, date(2026, 10, 13)), date(2026, 11, 1))
        self.assertEqual(next_occurrence(13, date(2026, 10, 13)), date(2026, 11, 13))
        self.assertEqual(next_occurrence(31, date(2026, 1, 31)), date(2026, 2, 28))
        self.assertEqual(next_occurrence(10, date(2026, 12, 10)), date(2027, 1, 10))


class MaterializeTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='admin_rec', password='x', role='admin', full_name='Anna Admin')
        self.rent = RecurringExpense.objects.create(
            category='rent', amount=Decimal('4500.00'), description='Czynsz', day_of_month=10,
            last_generated_on=date(2026, 8, 10), created_by=self.admin,
        )

    def test_adds_every_missed_month_up_to_today(self):
        created = materialize_due_expenses(today=date(2026, 10, 13))

        self.assertEqual(created, 2)
        expenses = Expense.objects.order_by('date')
        self.assertEqual([e.date for e in expenses], [date(2026, 9, 10), date(2026, 10, 10)])
        self.assertTrue(all(e.recurring == self.rent and e.created_by == self.admin for e in expenses))
        self.rent.refresh_from_db()
        self.assertEqual(self.rent.last_generated_on, date(2026, 10, 10))

    def test_is_safe_to_run_many_times(self):
        materialize_due_expenses(today=date(2026, 10, 13))

        self.assertEqual(materialize_due_expenses(today=date(2026, 10, 13)), 0)
        self.assertEqual(Expense.objects.count(), 2)

    def test_deleted_expense_is_not_added_again(self):
        materialize_due_expenses(today=date(2026, 10, 13))
        Expense.objects.filter(date=date(2026, 10, 10)).delete()

        materialize_due_expenses(today=date(2026, 10, 14))

        self.assertEqual(Expense.objects.count(), 1)

    def test_paused_template_adds_nothing(self):
        self.rent.is_active = False
        self.rent.save()

        self.assertEqual(materialize_due_expenses(today=date(2026, 10, 13)), 0)

    def test_generated_expenses_are_logged_as_system(self):
        materialize_due_expenses(today=date(2026, 9, 12))

        entry = AuditEntry.objects.get(action='expense.created')
        self.assertIsNone(entry.actor)
        self.assertEqual(entry.actor_name, 'System (wydatki cykliczne)')
        self.assertIn('Automatycznie', entry.description)

    def test_command_reports_how_many_were_added(self):
        self.rent.last_generated_on = date.today() - timedelta(days=40)
        self.rent.day_of_month = 31
        self.rent.save()
        out = StringIO()

        call_command('generate_recurring_expenses', stdout=out)

        self.assertIn(f'Dodano wydatków cyklicznych: {Expense.objects.count()}.', out.getvalue())
        self.assertGreaterEqual(Expense.objects.count(), 1)

    def test_opening_finance_adds_due_expenses(self):
        self.rent.last_generated_on = date.today() - timedelta(days=40)
        self.rent.save()
        api = APIClient()
        api.force_authenticate(self.admin)

        api.get('/api/finance/overview/')

        self.assertTrue(Expense.objects.filter(recurring=self.rent).exists())