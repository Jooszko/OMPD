from datetime import date, datetime, timedelta
from decimal import Decimal

from django.test import SimpleTestCase, TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from clients.models import Client, Route
from finance.models import Expense
from finance.statement import build_statement, period_bounds, period_label, previous_bounds
from orders.models import DailyOrder
from products.models import Ingredient, IngredientStock, Product, Recipe, StockMovement
from users.models import User

URL = '/api/finance/statement/'


class PeriodTests(SimpleTestCase):
    def test_bounds_of_month_quarter_and_year(self):
        anchor = date(2026, 8, 17)
        self.assertEqual(period_bounds('month', anchor), (date(2026, 8, 1), date(2026, 8, 31)))
        self.assertEqual(period_bounds('quarter', anchor), (date(2026, 7, 1), date(2026, 9, 30)))
        self.assertEqual(period_bounds('year', anchor), (date(2026, 1, 1), date(2026, 12, 31)))
        self.assertEqual(period_bounds('month', date(2028, 2, 10)), (date(2028, 2, 1), date(2028, 2, 29)))

    def test_previous_period_crosses_the_year(self):
        self.assertEqual(previous_bounds('month', date(2026, 1, 1)), (date(2025, 12, 1), date(2025, 12, 31)))
        self.assertEqual(previous_bounds('quarter', date(2026, 1, 1)), (date(2025, 10, 1), date(2025, 12, 31)))

    def test_labels(self):
        self.assertEqual(period_label('month', date(2026, 9, 1)), 'wrzesień 2026')
        self.assertEqual(period_label('quarter', date(2026, 7, 1)), 'III kwartał 2026')
        self.assertEqual(period_label('quarter', date(2026, 7, 1), short=True), 'III kw.')
        self.assertEqual(period_label('year', date(2026, 1, 1)), '2026')


class StatementTests(TestCase):
    def setUp(self):
        route = Route.objects.create(route_name='Trasa St')
        self.shop = Client.objects.create(name='Sklep St', address='Adres', route=route)
        self.bread = Product.objects.create(name='Chleb St', category='bread', base_price=Decimal('10.00'))

    def sale(self, day, quantity):
        DailyOrder.objects.create(
            client=self.shop, product=self.bread, order_date=day, quantity=quantity,
            price_at_sale=Decimal('10.00'), status='delivered',
        )

    def test_lines_compare_month_with_previous_month(self):
        self.sale(date(2026, 9, 5), 100)
        self.sale(date(2026, 8, 5), 80)
        Expense.objects.create(category='rent', amount=Decimal('300.00'), date=date(2026, 9, 1))
        Expense.objects.create(category='fuel', amount=Decimal('50.00'), date=date(2026, 8, 20))

        data = build_statement('month', date(2026, 9, 15), today=date(2026, 10, 14))
        lines = {line['key']: (line['amount'], line['previous']) for line in data['lines']}

        self.assertEqual(data['period']['label'], 'wrzesień 2026')
        self.assertEqual(data['period']['previous_label'], 'sierpień 2026')
        self.assertTrue(data['period']['is_complete'])
        self.assertEqual(lines['revenue'], ('1000.00', '800.00'))
        self.assertEqual(lines['rent'], ('-300.00', '0.00'))
        self.assertEqual(lines['fuel'], ('0.00', '-50.00'))
        self.assertEqual(lines['net_profit'], ('700.00', '750.00'))
        self.assertEqual([line['level'] for line in data['lines']][-2:], ['item', 'total'])
        self.assertEqual(data['net_margin_pct'], 70.0)

    def test_raw_material_lines_split_recipe_use_and_stock_losses(self):
        flour = Ingredient.objects.create(name='Mąka St', unit='kg')
        Recipe.objects.create(product=self.bread, ingredient=flour, amount=Decimal('0.500'))
        IngredientStock.objects.create(ingredient=flour, current_price=Decimal('4.00'))
        self.sale(date(2026, 9, 5), 10)
        StockMovement.objects.create(
            ingredient=flour, kind=StockMovement.KIND_COUNT, quantity=Decimal('-2'), balance_after=Decimal('0'),
            created_at=timezone.make_aware(datetime(2026, 9, 6, 15)),
        )

        data = build_statement('month', date(2026, 9, 15), today=date(2026, 10, 14))
        lines = {line['key']: (line['level'], line['amount']) for line in data['lines']}

        self.assertEqual(lines['materials'], ('sub', '-21.00'))
        self.assertEqual(lines['stock_losses'], ('sub', '-8.00'))
        self.assertEqual(lines['cogs'], ('item', '-29.00'))
        self.assertEqual(lines['gross_margin'], ('sum', '71.00'))

    def test_trend_and_days(self):
        self.sale(date(2026, 9, 5), 10)
        self.sale(date(2026, 5, 5), 4)

        data = build_statement('month', date(2026, 9, 15), today=date(2026, 10, 14))

        self.assertEqual([t['label'] for t in data['trend']], ['kwi', 'maj', 'cze', 'lip', 'sie', 'wrz'])
        self.assertEqual(data['trend'][1]['revenue'], '40.00')
        self.assertEqual(len(data['days']), 30)
        self.assertEqual(data['days'][4], {'date': '2026-09-05', 'net_profit': '100.00'})

    def test_current_month_counts_only_days_until_today(self):
        data = build_statement('month', date(2026, 10, 14), today=date(2026, 10, 14))

        self.assertEqual(len(data['days']), 14)
        self.assertFalse(data['period']['is_complete'])

    def test_quarter_has_no_calendar(self):
        data = build_statement('quarter', date(2026, 8, 1), today=date(2026, 10, 14))

        self.assertEqual(data['days'], [])
        self.assertEqual(len(data['trend']), 4)


class StatementApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(User.objects.create_user(username='admin_st', password='x', role='admin', full_name='A'))

    def test_defaults_to_current_month(self):
        response = self.api.get(URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['period']['start'], str(date.today().replace(day=1)))

    def test_rejects_invalid_requests(self):
        future = date.today().replace(day=1) + timedelta(days=40)
        for params in ({'period': 'week'}, {'date': '01.09.2026'}, {'date': str(future)}):
            with self.subTest(params=params):
                self.assertEqual(self.api.get(URL, params).status_code, 400)

    def test_only_admin_has_access(self):
        self.api.force_authenticate(User.objects.create_user(username='baker_st', password='x', role='baker', full_name='B'))

        self.assertEqual(self.api.get(URL).status_code, 403)