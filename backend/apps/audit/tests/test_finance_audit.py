from datetime import date

from django.test import TestCase
from rest_framework.test import APIClient

from audit.models import AuditEntry
from finance.models import Supplier, SupplierIngredient
from products.models import Ingredient
from users.models import User


def change_rows(entry):
    return [(c['label'], c['old'], c['new']) for c in entry.changes]


class FinanceAuditTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = User.objects.create_user(username='admin_f', password='x', role='admin', full_name='Anna Admin')
        self.api.force_authenticate(self.admin)
        self.flour = Ingredient.objects.create(name='Mąka', unit='kg')
        self.water = Ingredient.objects.create(name='Woda', unit='l')

    def test_new_supplier_lists_filled_fields_and_catalog(self):
        self.api.post(
            '/api/finance/suppliers/',
            {'name': 'Młyn Kowalski', 'products': [{'product_id': self.water.pk}, {'product_id': self.flour.pk}]},
            format='json',
        )

        entry = AuditEntry.objects.get(action='supplier.created')
        rows = change_rows(entry)
        self.assertIn(('Nazwa', None, 'Młyn Kowalski'), rows)
        self.assertIn(('Asortyment', None, 'Mąka, Woda'), rows)
        self.assertNotIn('Telefon', [label for label, _, _ in rows])

    def test_supplier_edit_shows_changed_data_and_catalog(self):
        supplier = Supplier.objects.create(name='Młyn Kowalski')
        SupplierIngredient.objects.create(supplier=supplier, ingredient=self.flour)
        SupplierIngredient.objects.create(supplier=supplier, ingredient=self.water)

        self.api.put(
            f'/api/finance/suppliers/{supplier.pk}/',
            {'phone': '500600700', 'products': [{'product_id': self.flour.pk}]},
            format='json',
        )

        entry = AuditEntry.objects.get(action='supplier.updated')
        self.assertEqual(change_rows(entry), [('Telefon', '', '500600700'), ('Asortyment', 'Mąka, Woda', 'Mąka')])

    def test_new_expense_is_described_with_amount(self):
        self.api.post(
            '/api/finance/expenses/',
            {'category': 'fuel', 'amount': '250', 'description': 'Tankowanie', 'date': '2026-10-11'},
            format='json',
        )

        entry = AuditEntry.objects.get(action='expense.created')
        self.assertEqual(entry.actor, self.admin)
        self.assertIn('Paliwo', entry.description)
        self.assertIn('250.00 zł', entry.description)

    def test_regenerating_report_shows_which_totals_changed(self):
        self.api.post('/api/finance/reports/')
        self.api.post(
            '/api/finance/expenses/',
            {'category': 'fuel', 'amount': '100', 'date': str(date.today())},
            format='json',
        )
        self.api.post('/api/finance/reports/')

        first = AuditEntry.objects.get(action='report.generated')
        second = AuditEntry.objects.get(action='report.regenerated')
        self.assertIn(('Koszty operacyjne', None, '0.00'), change_rows(first))
        self.assertEqual(
            change_rows(second),
            [('Koszty operacyjne', '0.00', '100.00'), ('Zysk netto', '0.00', '-100.00')],
        )

    def test_deleted_report_keeps_its_totals_in_the_log(self):
        self.api.post('/api/finance/reports/')

        self.api.delete(f'/api/finance/reports/{date.today()}/')

        entry = AuditEntry.objects.get(action='report.deleted')
        self.assertIn(('Zysk netto', '0.00', None), change_rows(entry))