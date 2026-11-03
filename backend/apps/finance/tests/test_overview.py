from datetime import date, datetime, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from clients.models import Client, Route
from finance.models import Expense
from orders.models import DailyOrder, ProductReturn
from products.models import Ingredient, IngredientStock, Product, StockMovement
from users.models import User

URL = '/api/finance/overview/'
PERIOD = {'start': '2026-09-01', 'end': '2026-09-10'}


class FinanceOverviewTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(
            User.objects.create_user(username='admin_ov', password='x', role='admin', full_name='Anna Admin')
        )
        self.route = Route.objects.create(route_name='Trasa Ov')
        self.bread = Product.objects.create(name='Chleb Ov', category='bread', base_price=Decimal('10.00'))

    def client_named(self, name):
        return Client.objects.create(name=name, address='Adres', route=self.route)

    def sale(self, client, day, quantity, status='delivered'):
        DailyOrder.objects.create(
            client=client, product=self.bread, order_date=date.fromisoformat(day),
            quantity=quantity, price_at_sale=Decimal('10.00'), status=status,
        )

    def test_totals_compare_with_previous_period_of_same_length(self):
        shop = self.client_named('Sklep A')
        self.sale(shop, '2026-09-03', 10)
        self.sale(shop, '2026-08-25', 4)
        Expense.objects.create(category='rent', amount=Decimal('30.00'), date=date(2026, 9, 5))

        data = self.api.get(URL, PERIOD).data

        self.assertEqual(data['period'], {
            'start': '2026-09-01', 'end': '2026-09-10',
            'previous_start': '2026-08-22', 'previous_end': '2026-08-31',
        })
        self.assertEqual(data['totals']['revenue'], '100.00')
        self.assertEqual(data['totals']['operating_expenses'], '30.00')
        self.assertEqual(data['totals']['net_profit'], '70.00')
        self.assertEqual(data['previous_totals']['revenue'], '40.00')

    def test_daily_series_accumulates_profit(self):
        shop = self.client_named('Sklep A')
        self.sale(shop, '2026-09-01', 5)
        Expense.objects.create(category='fuel', amount=Decimal('80.00'), date=date(2026, 9, 2))
        Expense.objects.create(category='other', amount=Decimal('5.00'), date=date(2026, 9, 2))

        daily = self.api.get(URL, PERIOD).data['daily']

        self.assertEqual(len(daily), 10)
        self.assertEqual([d['cumulative_profit'] for d in daily[:3]], ['50.00', '-35.00', '-35.00'])
        self.assertEqual(daily[1]['expenses'], [
            {'category': 'fuel', 'label': 'Paliwo', 'amount': '80.00'},
            {'category': 'other', 'label': 'Inne', 'amount': '5.00'},
        ])

    def test_top_clients_after_returns_with_deliveries_and_others(self):
        clients = [self.client_named(f'Klient {i}') for i in range(6)]
        for i, client in enumerate(clients):
            self.sale(client, '2026-09-02', 10 + 2 * i)
        self.sale(clients[0], '2026-09-03', 4)
        self.sale(clients[0], '2026-09-04', 1, status='in_delivery')
        ProductReturn.objects.create(
            client=clients[5], product=self.bread, return_date=date(2026, 9, 4), source_date=date(2026, 9, 2),
            quantity=10, unit_price=Decimal('10.00'),
        )
        self.sale(clients[4], '2026-08-30', 3)

        data = self.api.get(URL, PERIOD).data
        top = data['top_clients']

        self.assertEqual([c['name'] for c in top], ['Klient 4', 'Klient 3', 'Klient 0', 'Klient 2', 'Klient 1'])
        self.assertEqual(top[0]['previous_revenue'], '30.00')
        self.assertIsNone(top[1]['previous_revenue'])
        self.assertEqual(top[2]['revenue'], '150.00')
        self.assertEqual(top[2]['deliveries'], 2)
        self.assertEqual(data['other_clients'], {'clients': 1, 'revenue': '100.00'})

    def test_cost_structure_lists_raw_materials_then_used_categories(self):
        Expense.objects.create(category='salary', amount=Decimal('100.00'), date=date(2026, 9, 5))
        Expense.objects.create(category='fuel', amount=Decimal('20.00'), date=date(2026, 8, 28))

        rows = self.api.get(URL, PERIOD).data['cost_structure']

        self.assertEqual(
            [(r['key'], r['amount'], r['previous']) for r in rows],
            [('cogs', '0.00', '0.00'), ('fuel', '0.00', '20.00'), ('salary', '100.00', '0.00')],
        )

    def test_cost_structure_adds_stock_losses_to_raw_materials(self):
        flour = Ingredient.objects.create(name='Mąka Ov', unit='kg')
        IngredientStock.objects.create(ingredient=flour, current_price=Decimal('4.00'))
        StockMovement.objects.create(
            ingredient=flour, kind=StockMovement.KIND_LOSS, quantity=Decimal('-5'), balance_after=Decimal('0'),
            created_at=timezone.make_aware(datetime(2026, 9, 4, 12)),
        )

        data = self.api.get(URL, PERIOD).data

        self.assertEqual(
            [(r['key'], r['group'], r['amount']) for r in data['cost_structure']],
            [('cogs', 'cogs', '0.00'), ('stock_losses', 'cogs', '20.00')],
        )
        self.assertEqual(data['totals']['cogs'], '20.00')
        self.assertEqual(data['totals']['net_profit'], '-20.00')

    def test_recent_expenses_are_newest_five_in_period(self):
        for day in range(1, 8):
            Expense.objects.create(category='fuel', amount=Decimal(day), description=f'Paliwo {day}', date=date(2026, 9, day))
        Expense.objects.create(category='fuel', amount=Decimal('9.00'), date=date(2026, 9, 20))

        recent = self.api.get(URL, PERIOD).data['recent_expenses']

        self.assertEqual([e['description'] for e in recent], ['Paliwo 7', 'Paliwo 6', 'Paliwo 5', 'Paliwo 4', 'Paliwo 3'])

    def test_defaults_to_last_30_days(self):
        period = self.api.get(URL).data['period']

        self.assertEqual(period['end'], str(date.today()))
        self.assertEqual(period['start'], str(date.today() - timedelta(days=29)))

    def test_rejects_invalid_periods(self):
        for params in (
            {'start': '01.09.2026'},
            {'start': '2026-09-10', 'end': '2026-09-01'},
            {'start': '2025-01-01', 'end': '2026-09-01'},
        ):
            with self.subTest(params=params):
                response = self.api.get(URL, params)
                self.assertEqual(response.status_code, 400)
                self.assertIn('error', response.data)

    def test_only_admin_has_access(self):
        self.api.force_authenticate(User.objects.create_user(username='baker_ov', password='x', role='baker', full_name='B'))

        self.assertEqual(self.api.get(URL).status_code, 403)