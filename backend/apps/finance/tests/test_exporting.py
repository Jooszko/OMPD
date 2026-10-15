import csv
import io
from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from clients.models import Client, Route
from finance.models import DailyFinancialReport, Expense
from orders.models import DailyOrder, ProductReturn
from products.models import Product
from users.models import User

URL = '/api/finance/exports/'
SEPTEMBER = {'period': 'month', 'date': '2026-09-15'}


class ExportTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = User.objects.create_user(username='admin_ex', password='x', role='admin', full_name='Anna Admin')
        self.api.force_authenticate(self.admin)
        route = Route.objects.create(route_name='Trasa Ex')
        self.shop = Client.objects.create(name='Sklep Pod Lipą', address='Adres', route=route)
        self.cafe = Client.objects.create(name='Kawiarnia', address='Adres', route=route)
        self.bread = Product.objects.create(name='Chleb Ex', category='bread', base_price=Decimal('10.00'))

    def sale(self, client, day, quantity):
        DailyOrder.objects.create(
            client=client, product=self.bread, order_date=day, quantity=quantity,
            price_at_sale=Decimal('10.00'), status='delivered',
        )

    def download(self, kind, params=SEPTEMBER):
        response = self.api.get(f'{URL}{kind}/', params)
        content = response.content.decode('utf-8')
        return response, content, list(csv.reader(io.StringIO(content.lstrip('\ufeff')), delimiter=';'))

    def test_statement_is_excel_friendly(self):
        self.sale(self.shop, date(2026, 9, 5), 100)
        Expense.objects.create(category='rent', amount=Decimal('1234.50'), date=date(2026, 9, 1))

        response, content, rows = self.download('statement')

        self.assertEqual(response['Content-Type'], 'text/csv; charset=utf-8')
        self.assertEqual(response['Content-Disposition'], 'attachment; filename="rachunek-zyskow-i-strat-2026-09.csv"')
        self.assertTrue(content.startswith('\ufeff'))
        self.assertEqual(rows[0], ['Pozycja', 'wrzesień 2026', 'sierpień 2026'])
        self.assertIn(['Czynsz', '-1234,50', '0,00'], rows)
        self.assertEqual(rows[-1], ['Zysk netto', '-234,50', '0,00'])

    def test_expenses_list_in_date_order(self):
        Expense.objects.create(category='fuel', amount=Decimal('205.00'), description='Tankowanie', date=date(2026, 9, 10), created_by=self.admin)
        Expense.objects.create(category='rent', amount=Decimal('1360.00'), description='Czynsz', date=date(2026, 9, 1))
        Expense.objects.create(category='rent', amount=Decimal('1.00'), date=date(2026, 8, 31))

        _, _, rows = self.download('expenses')

        self.assertEqual(rows[1:], [
            ['01.09.2026', 'Czynsz', 'Czynsz', '1360,00', '', 'nie'],
            ['10.09.2026', 'Paliwo', 'Tankowanie', '205,00', 'Anna Admin', 'nie'],
        ])

    def test_clients_after_returns_sorted_by_revenue(self):
        self.sale(self.shop, date(2026, 9, 5), 10)
        self.sale(self.shop, date(2026, 9, 6), 10)
        self.sale(self.cafe, date(2026, 9, 5), 15)
        ProductReturn.objects.create(
            client=self.shop, product=self.bread, return_date=date(2026, 9, 7), source_date=date(2026, 9, 6),
            quantity=6, unit_price=Decimal('10.00'),
        )

        _, _, rows = self.download('clients')

        self.assertEqual(rows[1:], [
            ['Kawiarnia', '1', '150,00', '0,00', '150,00'],
            ['Sklep Pod Lipą', '2', '200,00', '60,00', '140,00'],
        ])

    def test_closings_show_status_and_drift(self):
        self.sale(self.shop, date(2026, 9, 5), 10)
        DailyFinancialReport.objects.create(
            report_date=date(2026, 9, 5), total_revenue=Decimal('100.00'), total_cogs=Decimal('0'),
            total_operating_expenses=Decimal('0'), net_profit=Decimal('120.00'), is_finalized=True, generated_by=self.admin,
        )

        _, _, rows = self.download('closings')

        self.assertEqual(len(rows), 31)
        self.assertEqual(rows[5], ['05.09.2026', '100,00', '0,00', '0,00', '100,00', 'zamknięty', 'Anna Admin', '120,00', '-20,00'])
        self.assertEqual(rows[1][5], 'otwarty')

    def test_quarter_file_name_and_current_period_until_today(self):
        response, _, rows = self.download('closings', {'period': 'quarter'})

        today = date.today()
        quarter = (today.month - 1) // 3 + 1
        self.assertIn(f'zamkniecia-dni-{today.year}-Q{quarter}.csv', response['Content-Disposition'])
        self.assertEqual(rows[-1][0], f'{today:%d.%m.%Y}')

    def test_rejects_unknown_export_and_future_period(self):
        self.assertEqual(self.api.get(f'{URL}payroll/', SEPTEMBER).status_code, 404)
        future = date.today().replace(day=1) + timedelta(days=40)
        self.assertEqual(self.api.get(f'{URL}expenses/', {'date': str(future)}).status_code, 400)

    def test_only_admin_can_export(self):
        self.api.force_authenticate(User.objects.create_user(username='baker_ex', password='x', role='baker', full_name='B'))

        self.assertEqual(self.api.get(f'{URL}expenses/', SEPTEMBER).status_code, 403)