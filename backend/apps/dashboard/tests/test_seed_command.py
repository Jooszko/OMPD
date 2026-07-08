from django.core.management import call_command
from django.test import TestCase

from clients.models import Client, Route
from finance.models import DailyFinancialReport, Expense, Supplier, SupplierIngredient, SupplyOrder
from orders.models import DailyOrder, StandingOrder
from products.models import Ingredient, IngredientStock, Product, Recipe
from users.models import Notification, User


class SeedDashboardCommandTests(TestCase):
    def test_seed_dashboard_populates_all_models(self):
        call_command('seed_dashboard')

        self.assertEqual(User.objects.count(), 20)
        self.assertEqual(Route.objects.count(), 6)
        self.assertEqual(Client.objects.count(), 40)
        self.assertEqual(Ingredient.objects.count(), 20)
        self.assertEqual(IngredientStock.objects.count(), 20)
        self.assertEqual(Product.objects.count(), 20)
        self.assertGreater(Recipe.objects.count(), 20)
        self.assertEqual(Supplier.objects.count(), 10)
        self.assertEqual(SupplierIngredient.objects.count(), 20)
        self.assertEqual(SupplyOrder.objects.count(), 25)
        self.assertGreaterEqual(StandingOrder.objects.count(), 45)
        self.assertGreater(DailyOrder.objects.count(), 0)
        self.assertGreater(Expense.objects.count(), 20)
        self.assertEqual(DailyFinancialReport.objects.count(), 31)
        self.assertEqual(Notification.objects.count(), 60)

    def test_seed_dashboard_is_idempotent_without_clear(self):
        call_command('seed_dashboard')
        call_command('seed_dashboard')

        self.assertEqual(User.objects.count(), 20)
        self.assertEqual(Client.objects.count(), 40)
        self.assertEqual(Product.objects.count(), 20)

    def test_seed_dashboard_clear_removes_seed_users(self):
        call_command('seed_dashboard')
        call_command('seed_dashboard', '--clear')

        self.assertEqual(Client.objects.count(), 40)
        self.assertEqual(User.objects.filter(username='mklukowski').count(), 1)
