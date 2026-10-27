from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from clients.models import Client, Route
from orders.models import StandingOrder
from products.models import Product
from users.models import User

URL = '/api/orders/standing/'


class StandingOrdersListTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(User.objects.create_user(username='b', password='x', role='baker', full_name='B'))
        driver = User.objects.create_user(username='d', password='x', role='driver', full_name='Jan Kierowca')
        route = Route.objects.create(route_name='Trasa 1', driver=driver)
        self.shop = Client.objects.create(name='Sklep', address='Rynek 1', route=route)
        self.bread = Product.objects.create(name='Chleb', category='bread', base_price=Decimal('4.50'))
        self.bun = Product.objects.create(name='Drożdżówka', category='buns', base_price=Decimal('2.00'))

    def standing(self, day, product, quantity):
        StandingOrder.objects.create(
            client=self.shop, product=product, day_of_week=day, quantity=quantity, price_at_sale=product.base_price
        )

    def test_groups_carry_the_client_route(self):
        for day in (0, 2):
            self.standing(day, self.bread, 10)

        group = self.api.get(URL).json()[0]

        self.assertEqual(
            (group['route_name'], group['driver_name'], group['client_active'], group['days_ids']),
            ('Trasa 1', 'Jan Kierowca', True, [0, 2]),
        )

    def test_each_day_keeps_its_own_basket(self):
        self.standing(0, self.bread, 10)
        self.standing(4, self.bread, 5)
        self.standing(4, self.bun, 30)

        group = self.api.get(URL).json()[0]

        self.assertEqual(
            [(day['day'], [(item['product_name'], item['qty']) for item in day['items']]) for day in group['schedule']],
            [(0, [('Chleb', 10)]), (4, [('Chleb', 5), ('Drożdżówka', 30)])],
        )
        self.assertEqual((group['schedule'][1]['total_quantity'], group['schedule'][1]['total_amount']), (35, 82.5))
        self.assertFalse(group['same_every_day'])
        self.assertEqual((group['weekly_quantity'], group['weekly_amount']), (45, 127.5))

    def test_identical_days_are_reported_as_the_same_basket(self):
        for day in (0, 1):
            self.standing(day, self.bread, 10)

        self.assertTrue(self.api.get(URL).json()[0]['same_every_day'])

    def test_saving_a_different_basket_per_day(self):
        response = self.api.post(
            URL,
            {
                'client_id': self.shop.pk,
                'schedule': [
                    {'day': 0, 'items': [{'product_id': self.bread.pk, 'qty': 10}]},
                    {'day': 4, 'items': [{'product_id': self.bread.pk, 'qty': 5}, {'product_id': self.bun.pk, 'qty': 30}]},
                ],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            sorted(StandingOrder.objects.values_list('day_of_week', 'product__name', 'quantity')),
            [(0, 'Chleb', 10), (4, 'Chleb', 5), (4, 'Drożdżówka', 30)],
        )

    def test_saving_replaces_the_previous_schedule(self):
        self.standing(2, self.bun, 7)

        self.api.post(
            URL,
            {'client_id': self.shop.pk, 'schedule': [{'day': 1, 'items': [{'product_id': self.bread.pk, 'qty': 3}]}]},
            format='json',
        )

        self.assertEqual(list(StandingOrder.objects.values_list('day_of_week', 'quantity')), [(1, 3)])

    def test_day_without_products_is_rejected(self):
        response = self.api.post(
            URL,
            {
                'client_id': self.shop.pk,
                'schedule': [
                    {'day': 0, 'items': [{'product_id': self.bread.pk, 'qty': 10}]},
                    {'day': 2, 'items': [{'product_id': self.bread.pk, 'qty': 0}]},
                ],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['error'], 'Dodaj produkty na: Śr.')
        self.assertFalse(StandingOrder.objects.exists())

    def test_invalid_schedule_is_rejected(self):
        for schedule in ([], [{'day': 9, 'items': []}], [{'day': 0}, {'day': 0}], 'Pn'):
            response = self.api.post(URL, {'client_id': self.shop.pk, 'schedule': schedule}, format='json')
            self.assertEqual(response.status_code, 400)
        self.assertFalse(StandingOrder.objects.exists())

    def test_unknown_product_leaves_previous_schedule(self):
        self.standing(2, self.bun, 7)

        response = self.api.post(
            URL,
            {'client_id': self.shop.pk, 'schedule': [{'day': 1, 'items': [{'product_id': 999999, 'qty': 3}]}]},
            format='json',
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(list(StandingOrder.objects.values_list('day_of_week', 'quantity')), [(2, 7)])
