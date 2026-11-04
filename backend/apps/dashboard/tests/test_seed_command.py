import shutil
import tempfile
from datetime import date, timedelta

from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings

from clients.models import Client, Route
from finance.models import (
    DailyFinancialReport, Expense, RecurringExpense, Supplier, SupplierIngredient,
)
from orders.models import DailyOrder, DeliveryProof, ProductReturn, StandingOrder
from production.models import Dough, Mixer, ProductBakeSpec, ProductionPlan
from products.models import Ingredient, IngredientStock, Product, Recipe
from dashboard.seed.production import DOUGH_DATA
from dashboard.seed.products import INGREDIENT_DATA, PRODUCT_DATA
from users.models import Notification, User

TEMP_MEDIA_ROOT = tempfile.mkdtemp()


def tearDownModule():
    shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)


@override_settings(DEBUG=True, MEDIA_ROOT=TEMP_MEDIA_ROOT)
class SeedDashboardCommandTests(TestCase):
    def test_seed_dashboard_populates_all_models(self):
        call_command('seed_dashboard')

        self.assertEqual(User.objects.count(), 20)
        self.assertEqual(Route.objects.count(), 6)
        self.assertEqual(Client.objects.count(), 40)
        self.assertEqual(Ingredient.objects.count(), len(INGREDIENT_DATA))
        self.assertEqual(IngredientStock.objects.count(), len(INGREDIENT_DATA))
        self.assertEqual(Product.objects.count(), len(PRODUCT_DATA))
        self.assertGreater(Recipe.objects.count(), 20)
        self.assertEqual(Mixer.objects.count(), 2)
        self.assertEqual(Dough.objects.count(), len(DOUGH_DATA))
        self.assertEqual(ProductBakeSpec.objects.count(), len(PRODUCT_DATA))
        self.assertEqual(Supplier.objects.count(), 10)
        self.assertEqual(SupplierIngredient.objects.count(), len(INGREDIENT_DATA))
        self.assertGreaterEqual(StandingOrder.objects.count(), 45)
        self.assertGreater(DailyOrder.objects.count(), 0)
        self.assertGreater(ProductReturn.objects.count(), 0)
        self.assertGreater(DeliveryProof.objects.count(), 0)
        self.assertTrue(DailyOrder.objects.filter(order_date=date.today() + timedelta(days=1)).exists())
        self.assertGreater(ProductionPlan.objects.count(), 0)
        self.assertGreater(Expense.objects.count(), 20)
        self.assertEqual(DailyFinancialReport.objects.count(), 177)
        self.assertEqual(RecurringExpense.objects.count(), 6)
        self.assertEqual(Notification.objects.count(), 60)

    def test_seed_dashboard_is_idempotent_without_clear(self):
        call_command('seed_dashboard')
        call_command('seed_dashboard')

        self.assertEqual(User.objects.count(), 20)
        self.assertEqual(Client.objects.count(), 40)
        self.assertEqual(Product.objects.count(), len(PRODUCT_DATA))

    def test_seed_dashboard_clear_removes_seed_users(self):
        call_command('seed_dashboard')
        call_command('seed_dashboard', '--clear')

        self.assertEqual(Client.objects.count(), 40)
        self.assertEqual(User.objects.filter(username='mklukowski').count(), 1)

    def test_days_sets_the_length_of_history(self):
        call_command('seed_dashboard', days=10)

        self.assertEqual(DailyFinancialReport.objects.count(), 7)
        self.assertFalse(DailyOrder.objects.filter(order_date__lt=date.today() - timedelta(days=9)).exists())

    def test_refuses_too_short_history(self):
        with self.assertRaises(CommandError):
            call_command('seed_dashboard', days=3)
@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class SeedPasswordTests(TestCase):
    def test_refuses_to_seed_a_server_without_a_password(self):
        with self.assertRaisesMessage(CommandError, 'SEED_PASSWORD'):
            call_command('seed_dashboard')

        self.assertFalse(User.objects.exists())

    def test_rejects_a_weak_password(self):
        with self.assertRaises(CommandError):
            call_command('seed_dashboard', password='12345')

        self.assertFalse(User.objects.exists())

    def test_uses_the_given_password(self):
        call_command('seed_dashboard', password='Piekarnia-Pokaz-2026')

        user = User.objects.get(username='mklukowski')
        self.assertTrue(user.check_password('Piekarnia-Pokaz-2026'))
        self.assertFalse(user.check_password('bakery2026'))

    def test_demo_keeps_only_showcase_accounts_active(self):
        call_command('seed_dashboard', password='Piekarnia-Pokaz-2026', demo=True)

        active = set(User.objects.filter(is_active=True).values_list('username', flat=True))
        self.assertEqual(active, {'mklukowski', 'akrawczyk', 'jnowak'})
        self.assertEqual(User.objects.count(), 20)

    def test_demo_resets_showcase_passwords_on_an_existing_database(self):
        call_command('seed_dashboard', password='Stare-Haslo-Pokazu-1')

        call_command('seed_dashboard', password='Nowe-Haslo-Pokazu-2', demo=True)

        self.assertTrue(User.objects.get(username='jnowak').check_password('Nowe-Haslo-Pokazu-2'))
        self.assertTrue(User.objects.get(username='anowak').check_password('Stare-Haslo-Pokazu-1'))