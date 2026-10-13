from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase

from clients.models import Client, Route
from finance.calculations import daily_results, period_totals
from finance.models import Expense, Supplier, SupplierIngredient
from orders.models import DailyOrder, ProductReturn
from products.models import Ingredient, Product, Recipe


class DailyResultsTests(TestCase):
    def setUp(self):
        self.day1 = date(2026, 9, 1)
        self.day2 = date(2026, 9, 2)
        self.day3 = date(2026, 9, 3)
        route = Route.objects.create(route_name='Trasa Calc')
        self.shop = Client.objects.create(name='Sklep Calc', address='Adres', route=route)
        self.bread = Product.objects.create(name='Chleb Calc', category='bread', base_price=Decimal('10.00'))

        flour = Ingredient.objects.create(name='Mąka Calc', unit='kg')
        yeast = Ingredient.objects.create(name='Drożdże Calc', unit='kg')
        Recipe.objects.create(product=self.bread, ingredient=flour, amount=Decimal('0.500'))
        Recipe.objects.create(product=self.bread, ingredient=yeast, amount=Decimal('0.010'))
        mill_a = Supplier.objects.create(name='Młyn A')
        mill_b = Supplier.objects.create(name='Młyn B')
        SupplierIngredient.objects.create(supplier=mill_a, ingredient=flour, last_price=Decimal('3.00'))
        SupplierIngredient.objects.create(supplier=mill_b, ingredient=flour, last_price=Decimal('5.00'))

    def order(self, day, quantity, status='delivered'):
        DailyOrder.objects.create(
            client=self.shop, product=self.bread, order_date=day,
            quantity=quantity, price_at_sale=Decimal('10.00'), status=status,
        )

    def test_returns_one_entry_per_day_including_empty_days(self):
        results = daily_results(self.day1, self.day3)

        self.assertEqual([r['date'] for r in results], [self.day1, self.day2, self.day3])
        self.assertEqual(results[1]['net_profit'], Decimal('0'))

    def test_revenue_skips_failed_and_cancelled_and_subtracts_returns(self):
        self.order(self.day1, 10)
        self.order(self.day1, 3, status='failed')
        self.order(self.day1, 2, status='cancelled')
        ProductReturn.objects.create(
            client=self.shop, product=self.bread, return_date=self.day1, source_date=self.day1 - timedelta(days=1),
            quantity=1, unit_price=Decimal('10.00'),
        )

        day = daily_results(self.day1, self.day1)[0]

        self.assertEqual(day['sales'], Decimal('100.00'))
        self.assertEqual(day['returns'], Decimal('10.00'))
        self.assertEqual(day['revenue'], Decimal('90.00'))

    def test_cogs_uses_recipe_and_average_supplier_price(self):
        self.order(self.day1, 10)
        self.order(self.day1, 2, status='failed')
        self.order(self.day1, 5, status='cancelled')

        day = daily_results(self.day1, self.day1)[0]

        self.assertEqual(day['cogs'], Decimal('24.00'))

    def test_net_profit_subtracts_cogs_and_operating_expenses(self):
        self.order(self.day2, 10)
        Expense.objects.create(category='fuel', amount=Decimal('20.00'), date=self.day2)
        Expense.objects.create(category='fuel', amount=Decimal('5.00'), date=self.day2)
        Expense.objects.create(category='rent', amount=Decimal('30.00'), date=self.day2)

        day = daily_results(self.day2, self.day2)[0]

        self.assertEqual(day['operating_expenses'], Decimal('55.00'))
        self.assertEqual(day['expenses_by_category'], {'fuel': Decimal('25.00'), 'rent': Decimal('30.00')})
        self.assertEqual(day['net_profit'], Decimal('100.00') - Decimal('20.00') - Decimal('55.00'))

    def test_period_totals_sum_all_days(self):
        self.order(self.day1, 10)
        self.order(self.day3, 5)
        Expense.objects.create(category='rent', amount=Decimal('40.00'), date=self.day2)

        totals = period_totals(daily_results(self.day1, self.day3))

        self.assertEqual(totals['revenue'], Decimal('150.00'))
        self.assertEqual(totals['cogs'], Decimal('30.00'))
        self.assertEqual(totals['operating_expenses'], Decimal('40.00'))
        self.assertEqual(totals['net_profit'], Decimal('80.00'))
        self.assertEqual(totals['expenses_by_category'], {'rent': Decimal('40.00')})