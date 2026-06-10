from datetime import date
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from users.models import User
from clients.models import Client, Route
from products.models import Ingredient, Product, Recipe
from orders.models import DailyOrder
from finance.models import DailyFinancialReport


class Command(BaseCommand):
    help = 'Wypełnia bazę danych danymi testowymi dla dashboardu'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Usuń istniejące dane testowe przed dodaniem nowych',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options['clear']:
            self._clear()

        today = date.today()

        ingredients = self._create_ingredients()
        products = self._create_products(ingredients)
        driver = self._create_driver()
        route = self._create_route(driver)
        clients = self._create_clients(route)
        self._create_orders(today, clients, products)
        self._create_financial_report(today)

        self.stdout.write(self.style.SUCCESS(
            f'Dane testowe załadowane dla daty: {today}'
        ))

    def _clear(self):
        DailyFinancialReport.objects.all().delete()
        DailyOrder.objects.all().delete()
        Recipe.objects.all().delete()
        Product.objects.all().delete()
        Ingredient.objects.all().delete()
        Client.objects.all().delete()
        Route.objects.all().delete()
        User.objects.filter(username__startswith='kierowca').delete()
        self.stdout.write('Usunięto istniejące dane testowe.')

    def _create_ingredients(self):
        data = [
            ('Mąka pszenna typ 550', 'kg', Decimal('320.000'), Decimal('50.000')),
            ('Mąka żytnia typ 720', 'kg', Decimal('80.000'), Decimal('20.000')),
            ('Woda', 'l', Decimal('500.000'), Decimal('100.000')),
            ('Drożdże świeże', 'kg', Decimal('12.500'), Decimal('3.000')),
            ('Sól', 'kg', Decimal('25.000'), Decimal('5.000')),
            ('Cukier', 'kg', Decimal('15.000'), Decimal('3.000')),
            ('Masło', 'kg', Decimal('8.000'), Decimal('2.000')),
            ('Olej rzepakowy', 'l', Decimal('1.500'), Decimal('5.000')),  # poniżej minimum - ostrzeżenie
        ]
        ingredients = {}
        for name, unit, stock, min_stock in data:
            obj, _ = Ingredient.objects.get_or_create(
                name=name,
                defaults={'unit': unit, 'current_stock': stock, 'min_stock_level': min_stock},
            )
            ingredients[name] = obj
        self.stdout.write(f'  Składniki: {len(ingredients)}')
        return ingredients

    def _create_products(self, ingredients):
        products_data = [
            ('Chleb pszenny 500g', 'bread', Decimal('4.50'), 200, [
                ('Mąka pszenna typ 550', Decimal('0.500')),
                ('Woda', Decimal('0.300')),
                ('Drożdże świeże', Decimal('0.010')),
                ('Sól', Decimal('0.008')),
            ]),
            ('Chleb razowy 500g', 'bread', Decimal('5.20'), 150, [
                ('Mąka żytnia typ 720', Decimal('0.400')),
                ('Mąka pszenna typ 550', Decimal('0.100')),
                ('Woda', Decimal('0.280')),
                ('Drożdże świeże', Decimal('0.008')),
                ('Sól', Decimal('0.008')),
            ]),
            ('Bułka pszenna', 'buns', Decimal('0.80'), 500, [
                ('Mąka pszenna typ 550', Decimal('0.080')),
                ('Woda', Decimal('0.045')),
                ('Drożdże świeże', Decimal('0.002')),
                ('Sól', Decimal('0.001')),
                ('Cukier', Decimal('0.003')),
                ('Masło', Decimal('0.005')),
            ]),
            ('Drożdżówka z serem', 'buns', Decimal('2.50'), 100, [
                ('Mąka pszenna typ 550', Decimal('0.120')),
                ('Woda', Decimal('0.050')),
                ('Drożdże świeże', Decimal('0.004')),
                ('Cukier', Decimal('0.020')),
                ('Masło', Decimal('0.030')),
                ('Olej rzepakowy', Decimal('0.010')),
            ]),
        ]

        products = {}
        for name, category, price, stock, recipe in products_data:
            product, _ = Product.objects.get_or_create(
                name=name,
                defaults={'category': category, 'base_price': price, 'current_stock': stock},
            )
            for ing_name, amount in recipe:
                Recipe.objects.get_or_create(
                    product=product,
                    ingredient=ingredients[ing_name],
                    defaults={'amount': amount},
                )
            products[name] = product
        self.stdout.write(f'  Produkty: {len(products)}')
        return products

    def _create_driver(self):
        driver, _ = User.objects.get_or_create(
            username='kierowca1',
            defaults={
                'full_name': 'Jan Nowak',
                'role': 'driver',
                'email': 'kierowca@bakery.pl',
            },
        )
        if _:
            driver.set_password('testpass123')
            driver.save()
        return driver

    def _create_route(self, driver):
        route, _ = Route.objects.get_or_create(
            route_name='Trasa A - Centrum',
            defaults={'driver': driver},
        )
        return route

    def _create_clients(self, route):
        clients_data = [
            ('Biedronka - Skoczów', 'ul. Targowa 12, Skoczów'),
            ('Społem Ustroń', 'ul. Sportowa 3, Ustroń'),
            ('Piekarnia lokalna "Ziarenko"', 'ul. Kwiatowa 7, Cieszyn'),
            ('Restauracja Pod Jelenie', 'ul. Leśna 22, Brenna'),
        ]
        clients = []
        for name, address in clients_data:
            client, _ = Client.objects.get_or_create(
                name=name,
                defaults={'address': address, 'route': route, 'is_active': True},
            )
            clients.append(client)
        self.stdout.write(f'  Klienci: {len(clients)}')
        return clients

    def _create_orders(self, today, clients, products):
        orders_data = [
            (clients[0], products['Chleb pszenny 500g'],   350, Decimal('4.50'), 'in_production'),
            (clients[0], products['Bułka pszenna'],         200, Decimal('0.80'), 'in_production'),
            (clients[1], products['Chleb pszenny 500g'],    80, Decimal('4.50'), 'planned'),
            (clients[1], products['Chleb razowy 500g'],     40, Decimal('5.20'), 'planned'),
            (clients[2], products['Chleb razowy 500g'],     60, Decimal('5.20'), 'delivered'),
            (clients[2], products['Drożdżówka z serem'],    25, Decimal('2.50'), 'delivered'),
            (clients[3], products['Bułka pszenna'],          30, Decimal('0.80'), 'in_production'),
            (clients[3], products['Drożdżówka z serem'],    15, Decimal('2.50'), 'planned'),
        ]
        count = 0
        for client, product, qty, price, status in orders_data:
            DailyOrder.objects.get_or_create(
                client=client,
                product=product,
                order_date=today,
                defaults={'quantity': qty, 'price_at_sale': price, 'status': status},
            )
            count += 1
        self.stdout.write(f'  Zamówienia na dziś ({today}): {count}')

    def _create_financial_report(self, today):
        report, created = DailyFinancialReport.objects.get_or_create(
            report_date=today,
            defaults={
                'total_revenue': Decimal('3020.50'),
                'total_cogs': Decimal('850.00'),
                'total_operating_expenses': Decimal('420.00'),
                'net_profit': Decimal('1750.50'),
                'is_finalized': False,
                'generated_by': None,
            },
        )
        if created:
            self.stdout.write(f'  Raport finansowy: utworzony')
        else:
            self.stdout.write(f'  Raport finansowy: już istnieje')
