from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from audit.models import AuditEntry
from clients.models import Client, Route
from orders.models import DailyOrder, StandingOrder, StandingOrderRun
from orders.standing import ensure_standing_orders
from products.models import Product
from users.models import User


class AutomaticStandingOrdersTests(TestCase):
    def setUp(self):
        self.shop = Client.objects.create(name='Sklep', address='Lipowa 1', route=Route.objects.create(route_name='A'))
        self.bread = Product.objects.create(name='Chleb', category='bread', base_price=Decimal('5.00'))
        for day_of_week in range(7):
            StandingOrder.objects.create(
                client=self.shop, product=self.bread, day_of_week=day_of_week, quantity=10,
                price_at_sale=Decimal('5.00'),
            )

    def test_creates_today_and_tomorrow_once(self):
        today = date(2026, 10, 21)

        ensure_standing_orders(today)
        ensure_standing_orders(today)

        self.assertEqual(
            sorted(DailyOrder.objects.values_list('order_date', flat=True)),
            [today, today + timedelta(days=1)],
        )
        self.assertEqual(AuditEntry.objects.filter(actor_name='System (zamówienia stałe)').count(), 2)

    def test_deleted_order_is_not_brought_back(self):
        today = date(2026, 10, 21)
        ensure_standing_orders(today)
        DailyOrder.objects.filter(order_date=today + timedelta(days=1)).delete()

        ensure_standing_orders(today)

        self.assertFalse(DailyOrder.objects.filter(order_date=today + timedelta(days=1)).exists())

    def test_holidays_are_skipped(self):
        ensure_standing_orders(date(2026, 11, 10))

        self.assertFalse(DailyOrder.objects.filter(order_date=date(2026, 11, 11)).exists())
        self.assertTrue(StandingOrderRun.objects.filter(order_date=date(2026, 11, 11)).exists())

    @override_settings(AUTO_STANDING_ORDERS=True)
    def test_any_api_request_prepares_the_orders(self):
        api = APIClient()
        api.force_authenticate(User.objects.create_user(username='b', password='x', role='baker', full_name='B'))

        api.get('/api/orders/daily/')

        today = timezone.localdate()
        self.assertEqual(
            set(StandingOrderRun.objects.values_list('order_date', flat=True)), {today, today + timedelta(days=1)},
        )