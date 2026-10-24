from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from clients.models import Client, Route
from orders.models import StandingOrder
from products.models import Product
from users.models import User


class StandingOrdersListTests(TestCase):
    def test_groups_carry_the_client_route(self):
        api = APIClient()
        api.force_authenticate(User.objects.create_user(username='b', password='x', role='baker', full_name='B'))
        driver = User.objects.create_user(username='d', password='x', role='driver', full_name='Jan Kierowca')
        route = Route.objects.create(route_name='Trasa 1', driver=driver)
        shop = Client.objects.create(name='Sklep', address='Rynek 1', route=route)
        bread = Product.objects.create(name='Chleb', category='bread', base_price=Decimal('4.50'))
        for day in (0, 2):
            StandingOrder.objects.create(client=shop, product=bread, day_of_week=day, quantity=10, price_at_sale=Decimal('4.50'))

        group = api.get('/api/orders/standing/').json()[0]

        self.assertEqual(
            (group['route_name'], group['driver_name'], group['client_active'], group['days_ids']),
            ('Trasa 1', 'Jan Kierowca', True, [0, 2]),
        )