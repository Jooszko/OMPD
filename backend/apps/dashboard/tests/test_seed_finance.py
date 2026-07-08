from datetime import date
from decimal import Decimal

from django.test import TestCase

from clients.models import Client, Route
from finance.models import DailyFinancialReport, Expense
from orders.models import DailyOrder
from products.models import Product
from users.models import User
from dashboard.seed.dates import build_date_range
from dashboard.seed.finance import create_expenses, create_financial_reports


class SeedFinanceTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin_test', password='x', role='admin', full_name='Admin Test'
        )
        driver = User.objects.create_user(
            username='driver_test', password='x', role='driver', full_name='Driver Test'
        )
        route = Route.objects.create(route_name='Trasa Test', driver=driver)
        self.client_obj = Client.objects.create(name='Klient Test', address='Testowa 1', route=route)
        self.product = Product.objects.create(name='Produkt Test', category='bread', base_price=Decimal('10.00'))
        self.date_range = build_date_range(date(2026, 7, 8))

        DailyOrder.objects.create(
            client=self.client_obj,
            product=self.product,
            order_date=self.date_range[0],
            quantity=10,
            price_at_sale=Decimal('10.00'),
            status='delivered',
        )

    def test_create_expenses_returns_positive_count(self):
        created_count = create_expenses(self.date_range, self.admin)

        self.assertGreater(created_count, 20)
        self.assertEqual(Expense.objects.count(), created_count)

    def test_create_financial_reports_creates_one_per_day(self):
        create_expenses(self.date_range, self.admin)

        created_count = create_financial_reports(self.date_range)

        self.assertEqual(created_count, len(self.date_range))
        self.assertEqual(DailyFinancialReport.objects.count(), len(self.date_range))

        first_day_report = DailyFinancialReport.objects.get(report_date=self.date_range[0])
        self.assertEqual(first_day_report.total_revenue, Decimal('100.00'))
        self.assertTrue(first_day_report.is_finalized)

        today_report = DailyFinancialReport.objects.get(report_date=self.date_range[-1])
        self.assertFalse(today_report.is_finalized)

    def test_create_financial_reports_is_idempotent(self):
        create_expenses(self.date_range, self.admin)
        create_financial_reports(self.date_range)

        create_financial_reports(self.date_range)

        self.assertEqual(DailyFinancialReport.objects.count(), len(self.date_range))
