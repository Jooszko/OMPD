from datetime import date, datetime, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from clients.models import Client, Route
from finance.calculations import daily_results, period_totals
from finance.models import Expense
from orders.models import DailyOrder, ProductReturn
from products.models import Ingredient, IngredientStock, Product, Recipe, StockMovement


class DailyResultsTests(TestCase):
    def setUp(self):
        self.day1 = date(2026, 9, 1)
        self.day2 = date(2026, 9, 2)
        self.day3 = date(2026, 9, 3)
        route = Route.objects.create(route_name='Trasa Calc')
        self.shop = Client.objects.create(name='Sklep Calc', address='Adres', route=route)
        self.bread = Product.objects.create(name='Chleb Calc', category='bread', base_price=Decimal('10.00'))

        self.flour = Ingredient.objects.create(name='Mąka Calc', unit='kg')
        self.yeast = Ingredient.objects.create(name='Drożdże Calc', unit='kg')
        Recipe.objects.create(product=self.bread, ingredient=self.flour, amount=Decimal('0.500'))
        Recipe.objects.create(product=self.bread, ingredient=self.yeast, amount=Decimal('0.010'))
        IngredientStock.objects.create(ingredient=self.flour, current_price=Decimal('4.00'))
        IngredientStock.objects.create(ingredient=self.yeast)

    def order(self, day, quantity, status='delivered'):
        DailyOrder.objects.create(
            client=self.shop, product=self.bread, order_date=day,
            quantity=quantity, price_at_sale=Decimal('10.00'), status=status,
        )

    def movement(self, ingredient, kind, quantity, at):
        StockMovement.objects.create(
            ingredient=ingredient, kind=kind, quantity=Decimal(quantity), balance_after=Decimal('0'),
            created_at=timezone.make_aware(at),
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

    def test_cogs_uses_recipe_and_warehouse_price(self):
        self.order(self.day1, 10)
        self.order(self.day1, 2, status='failed')
        self.order(self.day1, 5, status='cancelled')

        day = daily_results(self.day1, self.day1)[0]

        self.assertEqual(day['cogs'], Decimal('25.20'))

    def test_stock_losses_price_losses_and_inventory_differences_only(self):
        self.movement(self.flour, StockMovement.KIND_LOSS, '-2', datetime(2026, 9, 1, 10))
        self.movement(self.flour, StockMovement.KIND_COUNT, '-1', datetime(2026, 9, 1, 18))
        self.movement(self.flour, StockMovement.KIND_COUNT, '0.5', datetime(2026, 9, 2, 9))
        self.movement(self.flour, StockMovement.KIND_DELIVERY, '100', datetime(2026, 9, 1, 6))
        self.movement(self.flour, StockMovement.KIND_PRODUCTION, '-5', datetime(2026, 9, 1, 7))
        self.movement(self.flour, StockMovement.KIND_INITIAL, '50', datetime(2026, 9, 1, 5))

        day1, day2 = daily_results(self.day1, self.day2)

        self.assertEqual(day1['stock_losses'], Decimal('12.00'))
        self.assertEqual(day2['stock_losses'], Decimal('-2.00'))

    def test_stock_losses_add_to_cogs_and_lower_profit(self):
        self.order(self.day1, 10)
        self.movement(self.flour, StockMovement.KIND_LOSS, '-2', datetime(2026, 9, 1, 10))

        day = daily_results(self.day1, self.day1)[0]

        self.assertEqual(day['materials'], Decimal('21.00'))
        self.assertEqual(day['stock_losses'], Decimal('8.00'))
        self.assertEqual(day['cogs'], Decimal('29.00'))
        self.assertEqual(day['net_profit'], Decimal('71.00'))

    def test_stock_losses_use_polish_day_and_skip_unpriced_ingredients(self):
        self.movement(self.flour, StockMovement.KIND_LOSS, '-1', datetime(2026, 9, 1, 23, 30))
        self.movement(self.flour, StockMovement.KIND_LOSS, '-1', datetime(2026, 9, 2, 0, 30))
        self.movement(self.yeast, StockMovement.KIND_LOSS, '-3', datetime(2026, 9, 2, 12))

        day1, day2 = daily_results(self.day1, self.day2)

        self.assertEqual(day1['stock_losses'], Decimal('4.00'))
        self.assertEqual(day2['stock_losses'], Decimal('4.00'))

    def test_net_profit_subtracts_cogs_and_operating_expenses(self):
        self.order(self.day2, 10)
        Expense.objects.create(category='fuel', amount=Decimal('20.00'), date=self.day2)
        Expense.objects.create(category='fuel', amount=Decimal('5.00'), date=self.day2)
        Expense.objects.create(category='rent', amount=Decimal('30.00'), date=self.day2)

        day = daily_results(self.day2, self.day2)[0]

        self.assertEqual(day['operating_expenses'], Decimal('55.00'))
        self.assertEqual(day['expenses_by_category'], {'fuel': Decimal('25.00'), 'rent': Decimal('30.00')})
        self.assertEqual(day['net_profit'], Decimal('100.00') - Decimal('21.00') - Decimal('55.00'))