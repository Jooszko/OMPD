from decimal import Decimal

from products.models import Ingredient, IngredientStock, Product, Recipe

INGREDIENT_DATA = [
    # (name, unit, current_stock, min_stock_level)
    ('Mąka pszenna typ 550', 'kg', Decimal('320.000'), Decimal('50.000')),
    ('Mąka żytnia typ 720', 'kg', Decimal('80.000'), Decimal('20.000')),
    ('Mąka pszenna typ 750', 'kg', Decimal('150.000'), Decimal('30.000')),
    ('Woda', 'l', Decimal('500.000'), Decimal('100.000')),
    ('Drożdże świeże', 'kg', Decimal('12.500'), Decimal('3.000')),
    ('Sól', 'kg', Decimal('25.000'), Decimal('5.000')),
    ('Cukier', 'kg', Decimal('15.000'), Decimal('3.000')),
    ('Masło', 'kg', Decimal('8.000'), Decimal('2.000')),
    ('Olej rzepakowy', 'l', Decimal('1.500'), Decimal('5.000')),  # poniżej minimum
    ('Jaja', 'szt', Decimal('40.000'), Decimal('10.000')),
    ('Mleko', 'l', Decimal('60.000'), Decimal('15.000')),
    ('Ser żółty', 'kg', Decimal('10.000'), Decimal('3.000')),
    ('Twaróg', 'kg', Decimal('18.000'), Decimal('4.000')),
    ('Mak', 'kg', Decimal('5.000'), Decimal('1.000')),
    ('Rodzynki', 'kg', Decimal('4.000'), Decimal('1.000')),
    ('Cynamon', 'kg', Decimal('1.200'), Decimal('0.300')),
    ('Ziarna słonecznika', 'kg', Decimal('6.000'), Decimal('1.500')),
    ('Płatki owsiane', 'kg', Decimal('9.000'), Decimal('2.000')),
    ('Miód', 'kg', Decimal('3.500'), Decimal('1.000')),
    ('Czekolada', 'kg', Decimal('2.000'), Decimal('3.000')),  # poniżej minimum
]

PRODUCT_DATA = [
    # (name, category, base_price, current_stock, [(ingredient_name, amount), ...])
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
    ('Chleb wiejski 750g', 'bread', Decimal('6.00'), 120, [
        ('Mąka pszenna typ 750', Decimal('0.500')),
        ('Mąka żytnia typ 720', Decimal('0.150')),
        ('Woda', Decimal('0.350')),
        ('Drożdże świeże', Decimal('0.012')),
        ('Sól', Decimal('0.010')),
    ]),
    ('Chleb na zakwasie', 'bread', Decimal('7.50'), 80, [
        ('Mąka żytnia typ 720', Decimal('0.450')),
        ('Woda', Decimal('0.300')),
        ('Sól', Decimal('0.010')),
    ]),
    ('Bagietka francuska', 'bread', Decimal('3.20'), 100, [
        ('Mąka pszenna typ 550', Decimal('0.250')),
        ('Woda', Decimal('0.160')),
        ('Drożdże świeże', Decimal('0.005')),
        ('Sól', Decimal('0.005')),
    ]),
    ('Chleb słonecznikowy', 'bread', Decimal('6.20'), 70, [
        ('Mąka pszenna typ 550', Decimal('0.350')),
        ('Ziarna słonecznika', Decimal('0.050')),
        ('Woda', Decimal('0.220')),
        ('Drożdże świeże', Decimal('0.010')),
        ('Sól', Decimal('0.008')),
    ]),
    ('Bułka pszenna', 'buns', Decimal('0.80'), 500, [
        ('Mąka pszenna typ 550', Decimal('0.080')),
        ('Woda', Decimal('0.045')),
        ('Drożdże świeże', Decimal('0.002')),
        ('Sól', Decimal('0.001')),
    ]),
    ('Bułka grahamka', 'buns', Decimal('0.90'), 300, [
        ('Mąka pszenna typ 750', Decimal('0.070')),
        ('Woda', Decimal('0.040')),
        ('Drożdże świeże', Decimal('0.002')),
        ('Sól', Decimal('0.001')),
    ]),
    ('Bułka z serem', 'buns', Decimal('1.80'), 120, [
        ('Mąka pszenna typ 550', Decimal('0.080')),
        ('Ser żółty', Decimal('0.030')),
        ('Woda', Decimal('0.040')),
        ('Drożdże świeże', Decimal('0.002')),
    ]),
    ('Bułka mleczna', 'buns', Decimal('1.00'), 180, [
        ('Mąka pszenna typ 550', Decimal('0.070')),
        ('Mleko', Decimal('0.040')),
        ('Cukier', Decimal('0.008')),
        ('Masło', Decimal('0.010')),
        ('Drożdże świeże', Decimal('0.002')),
    ]),
    ('Rogal maślany', 'buns', Decimal('2.20'), 200, [
        ('Mąka pszenna typ 550', Decimal('0.100')),
        ('Masło', Decimal('0.030')),
        ('Cukier', Decimal('0.010')),
        ('Drożdże świeże', Decimal('0.003')),
        ('Jaja', Decimal('0.020')),
    ]),
    ('Drożdżówka z serem', 'buns', Decimal('2.50'), 100, [
        ('Mąka pszenna typ 550', Decimal('0.120')),
        ('Woda', Decimal('0.050')),
        ('Drożdże świeże', Decimal('0.004')),
        ('Cukier', Decimal('0.020')),
        ('Masło', Decimal('0.030')),
        ('Olej rzepakowy', Decimal('0.010')),
    ]),
    ('Drożdżówka z makiem', 'pastry', Decimal('2.60'), 90, [
        ('Mąka pszenna typ 550', Decimal('0.120')),
        ('Mak', Decimal('0.030')),
        ('Cukier', Decimal('0.020')),
        ('Masło', Decimal('0.025')),
        ('Drożdże świeże', Decimal('0.004')),
    ]),
    ('Pączek z nadzieniem różanym', 'pastry', Decimal('3.00'), 150, [
        ('Mąka pszenna typ 550', Decimal('0.100')),
        ('Jaja', Decimal('0.020')),
        ('Cukier', Decimal('0.015')),
        ('Masło', Decimal('0.020')),
        ('Drożdże świeże', Decimal('0.004')),
    ]),
    ('Sernik kawałek', 'pastry', Decimal('6.50'), 40, [
        ('Twaróg', Decimal('0.200')),
        ('Jaja', Decimal('0.050')),
        ('Cukier', Decimal('0.040')),
        ('Masło', Decimal('0.030')),
    ]),
    ('Szarlotka kawałek', 'pastry', Decimal('5.80'), 40, [
        ('Mąka pszenna typ 550', Decimal('0.080')),
        ('Masło', Decimal('0.040')),
        ('Cukier', Decimal('0.030')),
        ('Jaja', Decimal('0.020')),
    ]),
    ('Chałka z rodzynkami', 'pastry', Decimal('8.00'), 50, [
        ('Mąka pszenna typ 550', Decimal('0.300')),
        ('Jaja', Decimal('0.040')),
        ('Cukier', Decimal('0.030')),
        ('Masło', Decimal('0.030')),
        ('Rodzynki', Decimal('0.040')),
        ('Drożdże świeże', Decimal('0.010')),
    ]),
    ('Ciasteczka owsiane', 'pastry', Decimal('1.50'), 200, [
        ('Płatki owsiane', Decimal('0.030')),
        ('Masło', Decimal('0.015')),
        ('Cukier', Decimal('0.010')),
        ('Miód', Decimal('0.005')),
    ]),
    ('Croissant czekoladowy', 'pastry', Decimal('3.50'), 90, [
        ('Mąka pszenna typ 550', Decimal('0.090')),
        ('Masło', Decimal('0.040')),
        ('Czekolada', Decimal('0.020')),
        ('Cukier', Decimal('0.010')),
    ]),
    ('Rogalik cynamonowy', 'pastry', Decimal('2.80'), 100, [
        ('Mąka pszenna typ 550', Decimal('0.090')),
        ('Cynamon', Decimal('0.005')),
        ('Cukier', Decimal('0.015')),
        ('Masło', Decimal('0.025')),
        ('Drożdże świeże', Decimal('0.003')),
    ]),
]


def create_ingredients():
    ingredients = {}
    for name, unit, stock, min_stock in INGREDIENT_DATA:
        ingredient, _ = Ingredient.objects.get_or_create(name=name, defaults={'unit': unit})
        IngredientStock.objects.get_or_create(
            ingredient=ingredient,
            defaults={'current_stock': stock, 'min_stock_level': min_stock},
        )
        ingredients[name] = ingredient
    return ingredients


def create_products(ingredients):
    products = {}
    for name, category, price, stock, recipe in PRODUCT_DATA:
        product, _ = Product.objects.get_or_create(
            name=name,
            defaults={'category': category, 'base_price': price, 'current_stock': stock},
        )
        for ingredient_name, amount in recipe:
            Recipe.objects.get_or_create(
                product=product,
                ingredient=ingredients[ingredient_name],
                defaults={'amount': amount},
            )
        products[name] = product
    return products
