"""
Komenda do załadowania przykładowych danych demo.
Użycie: python manage.py populate_demo_data
"""
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = 'Ładuje przykładowe dane demo do bazy danych'

    def handle(self, *args, **options):
        self.stdout.write('Ładowanie danych demo...\n')
        self._create_users()
        self._create_ingredients()
        self._create_products()
        self._create_recipes()
        self._create_routes_and_clients()
        self._create_standing_orders()
        self._create_daily_orders()
        self._create_supply_purchases()
        self._create_expenses()
        self._create_financial_report()
        self.stdout.write(self.style.SUCCESS('\nDane demo załadowane pomyślnie!'))

    # ------------------------------------------------------------------

    def _create_users(self):
        from users.models import User
        users = [
            dict(username='admin',   password='admin123',   role='admin',   full_name='Administrator',     is_superuser=True, is_staff=True),
            dict(username='manager', password='manager123', role='manager', full_name='Piotr Nowak',        is_staff=True),
            dict(username='baker',   password='baker123',   role='baker',   full_name='Anna Kowalska'),
            dict(username='driver1', password='driver123',  role='driver',  full_name='Marek Wiśniewski'),
            dict(username='driver2', password='driver123',  role='driver',  full_name='Tomasz Zając'),
        ]
        for data in users:
            is_su = data.pop('is_superuser', False)
            is_staff = data.pop('is_staff', False)
            password = data.pop('password')
            user, created = User.objects.get_or_create(username=data['username'], defaults=data)
            if created:
                user.set_password(password)
                user.is_superuser = is_su
                user.is_staff = is_staff
                user.save()
                self.stdout.write(f'  [+] Użytkownik: {user.username}')

    def _create_ingredients(self):
        from products.models import Ingredient
        ingredients = [
            ('Mąka pszenna typ 550',  'kg',  150.000, 50.0),
            ('Mąka żytnia typ 720',   'kg',   80.000, 30.0),
            ('Drożdże świeże',        'kg',    3.500,  1.0),
            ('Sól',                   'kg',   20.000,  5.0),
            ('Cukier',                'kg',   15.000,  5.0),
            ('Masło 82%',             'kg',    8.000,  3.0),
            ('Jajka',                 'szt',  120.000, 30.0),
            ('Mleko',                 'l',    20.000,  5.0),
            ('Olej rzepakowy',        'l',    10.000,  3.0),
            ('Mak',                   'kg',    5.000,  1.0),
            ('Sezam',                 'kg',    4.000,  1.0),
            ('Drożdże instant',       'kg',    2.000,  0.5),
        ]
        for name, unit, stock, min_stock in ingredients:
            obj, created = Ingredient.objects.get_or_create(
                name=name,
                defaults={'unit': unit, 'current_stock': stock, 'min_stock_level': min_stock}
            )
            if created:
                self.stdout.write(f'  [+] Składnik: {name}')

    def _create_products(self):
        from products.models import Product
        products = [
            ('Chleb pszenny 500g',      'Chleby',   Decimal('4.50')),
            ('Chleb żytni 500g',        'Chleby',   Decimal('4.80')),
            ('Chleb razowy 400g',       'Chleby',   Decimal('5.20')),
            ('Bułka kajzerka',          'Bułki',    Decimal('0.80')),
            ('Bułka grahamka',          'Bułki',    Decimal('0.90')),
            ('Bułka maślana',           'Bułki',    Decimal('1.20')),
            ('Rogal maślany',           'Rogale',   Decimal('2.50')),
            ('Rogal z makiem',          'Rogale',   Decimal('2.80')),
            ('Croissant',               'Rogale',   Decimal('3.50')),
            ('Drożdżówka z serem',      'Słodkie',  Decimal('3.00')),
            ('Drożdżówka z jagodami',   'Słodkie',  Decimal('3.20')),
            ('Pączek',                  'Słodkie',  Decimal('2.50')),
        ]
        for name, category, price in products:
            obj, created = Product.objects.get_or_create(
                name=name,
                defaults={'category': category, 'base_price': price}
            )
            if created:
                self.stdout.write(f'  [+] Produkt: {name}')

    def _create_recipes(self):
        from products.models import Product, Ingredient, Recipe

        def add(product_name, ingredient_name, amount):
            try:
                product = Product.objects.get(name=product_name)
                ingredient = Ingredient.objects.get(name=ingredient_name)
                Recipe.objects.get_or_create(product=product, ingredient=ingredient, defaults={'amount': amount})
            except (Product.DoesNotExist, Ingredient.DoesNotExist):
                pass

        # Chleb pszenny 500g
        add('Chleb pszenny 500g',    'Mąka pszenna typ 550', Decimal('0.350'))
        add('Chleb pszenny 500g',    'Drożdże świeże',       Decimal('0.010'))
        add('Chleb pszenny 500g',    'Sól',                  Decimal('0.008'))

        # Chleb żytni 500g
        add('Chleb żytni 500g',      'Mąka żytnia typ 720',  Decimal('0.320'))
        add('Chleb żytni 500g',      'Mąka pszenna typ 550', Decimal('0.080'))
        add('Chleb żytni 500g',      'Drożdże świeże',       Decimal('0.008'))
        add('Chleb żytni 500g',      'Sól',                  Decimal('0.008'))

        # Bułka kajzerka
        add('Bułka kajzerka',        'Mąka pszenna typ 550', Decimal('0.080'))
        add('Bułka kajzerka',        'Drożdże instant',      Decimal('0.002'))
        add('Bułka kajzerka',        'Sól',                  Decimal('0.002'))

        # Rogal maślany
        add('Rogal maślany',         'Mąka pszenna typ 550', Decimal('0.100'))
        add('Rogal maślany',         'Masło 82%',            Decimal('0.030'))
        add('Rogal maślany',         'Cukier',               Decimal('0.015'))
        add('Rogal maślany',         'Jajka',                Decimal('0.500'))
        add('Rogal maślany',         'Drożdże świeże',       Decimal('0.005'))

        # Pączek
        add('Pączek',                'Mąka pszenna typ 550', Decimal('0.090'))
        add('Pączek',                'Masło 82%',            Decimal('0.020'))
        add('Pączek',                'Cukier',               Decimal('0.020'))
        add('Pączek',                'Jajka',                Decimal('1.000'))
        add('Pączek',                'Olej rzepakowy',       Decimal('0.010'))

        self.stdout.write('  [+] Receptury dodane')

    def _create_routes_and_clients(self):
        from users.models import User
        from clients.models import Route, Client

        driver1 = User.objects.filter(username='driver1').first()
        driver2 = User.objects.filter(username='driver2').first()

        trasa1, _ = Route.objects.get_or_create(route_name='Trasa Centrum',  defaults={'driver': driver1})
        trasa2, _ = Route.objects.get_or_create(route_name='Trasa Południe', defaults={'driver': driver2})
        trasa3, _ = Route.objects.get_or_create(route_name='Trasa Północ',   defaults={'driver': driver1})

        clients = [
            ('Sklep Spożywczy "Kowalski"',      'ul. Długa 12, Kraków',            trasa1),
            ('Piekarnia Centralna',             'ul. Rynek 5, Kraków',             trasa1),
            ('Restauracja "Pod Lipami"',        'ul. Lipowa 33, Kraków',           trasa1),
            ('Sklep "Zdrowa Żywność"',          'ul. Zielona 7, Kraków',           trasa2),
            ('Hotel Europejski',                'ul. Europejska 1, Kraków',        trasa2),
            ('Przedszkole nr 15',               'ul. Słoneczna 22, Kraków',        trasa2),
            ('Stołówka Szkolna ZSO nr 3',       'ul. Mickiewicza 8, Kraków',       trasa3),
            ('Kawiarnia "Aroma"',               'ul. Kawowa 4, Kraków',            trasa3),
            ('Sklep "U Marka"',                 'ul. Polna 19, Kraków',            trasa3),
            ('Catering "Smaczny Dzień"',        'ul. Przemysłowa 55, Kraków',      trasa2),
        ]
        for name, address, route in clients:
            obj, created = Client.objects.get_or_create(
                name=name,
                defaults={'address': address, 'route': route, 'is_active': True}
            )
            if created:
                self.stdout.write(f'  [+] Klient: {name}')

    def _create_standing_orders(self):
        from clients.models import Client
        from products.models import Product
        from orders.models import StandingOrder

        orders = [
            ('Sklep Spożywczy "Kowalski"',   'Chleb pszenny 500g',   [0,1,2,3,4,5], 20),
            ('Sklep Spożywczy "Kowalski"',   'Bułka kajzerka',       [0,1,2,3,4,5], 50),
            ('Piekarnia Centralna',          'Chleb żytni 500g',     [0,2,4],        15),
            ('Restauracja "Pod Lipami"',     'Rogal maślany',        [0,1,2,3,4],    10),
            ('Restauracja "Pod Lipami"',     'Croissant',            [0,1,2,3,4],     8),
            ('Hotel Europejski',             'Chleb pszenny 500g',   [0,1,2,3,4,5,6], 5),
            ('Hotel Europejski',             'Rogal maślany',        [0,1,2,3,4,5,6], 15),
            ('Przedszkole nr 15',            'Chleb pszenny 500g',   [0,1,2,3,4],    10),
            ('Kawiarnia "Aroma"',            'Croissant',            [0,1,2,3,4,5],  20),
            ('Kawiarnia "Aroma"',            'Pączek',               [5,6],          30),
        ]
        for client_name, product_name, days, qty in orders:
            try:
                client = Client.objects.get(name=client_name)
                product = Product.objects.get(name=product_name)
                for day in days:
                    StandingOrder.objects.get_or_create(
                        client=client, product=product, day_of_week=day,
                        defaults={'quantity': qty, 'is_active': True}
                    )
            except (Client.DoesNotExist, Product.DoesNotExist):
                pass
        self.stdout.write('  [+] Zamówienia stałe dodane')

    def _create_daily_orders(self):
        from datetime import date, timedelta
        from clients.models import Client
        from products.models import Product
        from orders.models import DailyOrder

        today = date.today()
        orders = [
            ('Sklep Spożywczy "Kowalski"',  'Chleb pszenny 500g',  today,              20, Decimal('4.50'), 'delivered'),
            ('Sklep Spożywczy "Kowalski"',  'Bułka kajzerka',      today,              50, Decimal('0.80'), 'delivered'),
            ('Piekarnia Centralna',         'Chleb żytni 500g',    today,              15, Decimal('4.50'), 'confirmed'),
            ('Restauracja "Pod Lipami"',    'Rogal maślany',       today,              10, Decimal('2.30'), 'confirmed'),
            ('Hotel Europejski',            'Chleb pszenny 500g',  today,               5, Decimal('4.50'), 'pending'),
            ('Hotel Europejski',            'Rogal maślany',       today,              15, Decimal('2.30'), 'pending'),
            ('Kawiarnia "Aroma"',           'Croissant',           today,              20, Decimal('3.20'), 'pending'),
            ('Sklep Spożywczy "Kowalski"',  'Chleb pszenny 500g',  today - timedelta(days=1), 20, Decimal('4.50'), 'delivered'),
            ('Piekarnia Centralna',         'Chleb żytni 500g',    today - timedelta(days=1), 12, Decimal('4.50'), 'delivered'),
            ('Kawiarnia "Aroma"',           'Pączek',              today - timedelta(days=1), 30, Decimal('2.30'), 'delivered'),
        ]
        for client_name, product_name, order_date, qty, price, status in orders:
            try:
                client = Client.objects.get(name=client_name)
                product = Product.objects.get(name=product_name)
                DailyOrder.objects.get_or_create(
                    client=client, product=product, order_date=order_date,
                    defaults={'quantity': qty, 'price_at_sale': price, 'status': status}
                )
            except (Client.DoesNotExist, Product.DoesNotExist):
                pass
        self.stdout.write('  [+] Zamówienia dzienne dodane')

    def _create_supply_purchases(self):
        from datetime import timedelta
        from products.models import Ingredient
        from finance.models import SupplyPurchase

        today = timezone.now()
        purchases = [
            ('Mąka pszenna typ 550', Decimal('100.000'), Decimal('2.80'), today - timedelta(days=3)),
            ('Mąka żytnia typ 720',  Decimal('50.000'),  Decimal('3.10'), today - timedelta(days=3)),
            ('Drożdże świeże',       Decimal('5.000'),   Decimal('18.00'), today - timedelta(days=1)),
            ('Masło 82%',            Decimal('10.000'),  Decimal('32.00'), today - timedelta(days=2)),
            ('Jajka',                Decimal('200.000'), Decimal('0.65'),  today - timedelta(days=2)),
            ('Cukier',               Decimal('20.000'),  Decimal('3.50'),  today - timedelta(days=5)),
        ]
        for ing_name, qty, unit_price, purchase_date in purchases:
            try:
                ingredient = Ingredient.objects.get(name=ing_name)
                SupplyPurchase.objects.get_or_create(
                    ingredient=ingredient,
                    purchase_date=purchase_date,
                    defaults={'quantity': qty, 'unit_price': unit_price}
                )
            except Ingredient.DoesNotExist:
                pass
        self.stdout.write('  [+] Zakupy surowców dodane')

    def _create_expenses(self):
        from datetime import date, timedelta
        from users.models import User
        from finance.models import Expense

        manager = User.objects.filter(username='manager').first()
        today = date.today()
        expenses = [
            ('Energia elektryczna', Decimal('1200.00'), 'Faktura za prąd maj 2026',         today.replace(day=1)),
            ('Wynajem lokalu',      Decimal('3500.00'), 'Czynsz za maj 2026',               today.replace(day=1)),
            ('Paliwo',              Decimal('450.00'),  'Tankowanie — trasa Centrum',       today - timedelta(days=1)),
            ('Paliwo',              Decimal('380.00'),  'Tankowanie — trasa Południe',      today - timedelta(days=1)),
            ('Serwis pieca',        Decimal('800.00'),  'Przegląd pieca obrotowego',        today - timedelta(days=5)),
            ('Marketing',           Decimal('250.00'),  'Ulotki reklamowe',                 today - timedelta(days=7)),
        ]
        for category, amount, description, exp_date in expenses:
            Expense.objects.get_or_create(
                category=category, date=exp_date,
                defaults={'amount': amount, 'description': description, 'created_by': manager}
            )
        self.stdout.write('  [+] Wydatki dodane')

    def _create_financial_report(self):
        from datetime import date, timedelta
        from users.models import User
        from finance.models import DailyFinancialReport

        manager = User.objects.filter(username='manager').first()
        yesterday = date.today() - timedelta(days=1)
        DailyFinancialReport.objects.get_or_create(
            report_date=yesterday,
            defaults={
                'total_revenue':             Decimal('2340.50'),
                'total_cogs':                Decimal('780.20'),
                'total_operating_expenses':  Decimal('320.00'),
                'net_profit':                Decimal('1240.30'),
                'is_finalized':              True,
                'generated_by':              manager,
            }
        )
        self.stdout.write('  [+] Raport finansowy dodany')
