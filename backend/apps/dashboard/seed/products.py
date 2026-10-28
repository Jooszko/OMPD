import random
from collections import defaultdict
from datetime import datetime, time, timedelta
from decimal import ROUND_DOWN, Decimal

from django.utils import timezone

from production.models import BatchIngredient, BatchStageLog, ProductionBatch
from products.models import Ingredient, IngredientStock, Product, Recipe, StockMovement
from products.stock import recalculate_min_stock

INGREDIENT_DATA = [
    # (name, unit, typowe dzienne zużycie, na ile dni starcza obecny stan)
    # Zużycie jest używane tylko dla dni bez danych z produkcji (starsza historia i surowce spoza
    # receptur ciast). Próg minimalny = zużycie z 7 dni, więc zapas < 7 dni to „poniżej minimum”,
    # a 7–10,5 dnia to „blisko minimum”.
    ('Mąka pszenna typ 550', 'kg', Decimal('280'), Decimal('16')),
    ('Mąka żytnia typ 720', 'kg', Decimal('22'), Decimal('12')),
    ('Mąka pszenna typ 750', 'kg', Decimal('17'), Decimal('18')),
    ('Woda', 'l', Decimal('175'), Decimal('30')),
    ('Drożdże świeże', 'kg', Decimal('6.5'), Decimal('9')),  # blisko minimum
    ('Sól', 'kg', Decimal('4.9'), Decimal('21')),
    ('Cukier', 'kg', Decimal('2.4'), Decimal('17')),
    ('Masło', 'kg', Decimal('2.9'), Decimal('9.5')),  # blisko minimum
    ('Olej rzepakowy', 'l', Decimal('1.5'), Decimal('1')),  # poniżej minimum
    ('Jaja', 'szt', Decimal('14'), Decimal('12')),
    ('Mleko', 'l', Decimal('11'), Decimal('11')),
    ('Ser żółty', 'kg', Decimal('0.9'), Decimal('13')),
    ('Twaróg', 'kg', Decimal('1.2'), Decimal('15')),
    ('Mak', 'kg', Decimal('0.35'), Decimal('19')),
    ('Rodzynki', 'kg', Decimal('0.3'), Decimal('14')),
    ('Cynamon', 'kg', Decimal('0.09'), Decimal('24')),
    ('Ziarna słonecznika', 'kg', Decimal('0.45'), Decimal('13')),
    ('Płatki owsiane', 'kg', Decimal('0.6'), Decimal('16')),
    ('Miód', 'kg', Decimal('0.25'), Decimal('11')),
    ('Czekolada', 'kg', Decimal('0.9'), Decimal('2')),  # poniżej minimum
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
    for name, unit, *_ in INGREDIENT_DATA:
        ingredient, _ = Ingredient.objects.get_or_create(name=name, defaults={'unit': unit})
        IngredientStock.objects.get_or_create(ingredient=ingredient)
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


WEEKDAY_USAGE = [Decimal(x) for x in ('1.0', '0.9', '1.0', '1.0', '1.15', '1.3', '0.35')]
PRODUCTION_HOUR = 21
DELIVERY_HOUR = 7


def _moment(day, hour, minute=0):
    return timezone.make_aware(datetime.combine(day, time(hour, minute)))


def _real_usage():
    """Zużycie z wygenerowanych dzieży (koniec mieszania już minął): {ingredient_id: {dzień: ilość}}."""
    now = timezone.now()
    usage = defaultdict(lambda: defaultdict(Decimal))
    mixed = BatchStageLog.objects.filter(
        stage=ProductionBatch.STAGE_MIXING, finished_at__isnull=False, finished_at__lte=now
    ).values_list('batch_id', 'finished_at')
    mixed_on = {batch_id: timezone.localdate(finished_at) for batch_id, finished_at in mixed}
    for batch_id, ingredient_id, amount in BatchIngredient.objects.filter(
        batch_id__in=mixed_on
    ).values_list('batch_id', 'ingredient_id', 'amount'):
        usage[ingredient_id][mixed_on[batch_id]] += amount
    return usage


def _step(weekly):
    if weekly >= 100:
        return Decimal('25')
    if weekly >= 10:
        return Decimal('5')
    if weekly >= 1:
        return Decimal('1')
    return Decimal('0.1')


def create_stock_history(ingredients, date_range, user):
    """Historia ruchów magazynowych i bieżące stany spójne z produkcją.

    Dni z wygenerowanymi dzieżami zużywają dokładnie to, co odważono; wcześniejsze dni (i surowce,
    których nie ma w recepturach ciast) – typowe zużycie z INGREDIENT_DATA. Stan na dziś to
    zapas na zadaną liczbę dni, a historia jest liczona od dziś wstecz: gdy stan „sprzed”
    przekroczyłby zapas maksymalny, rano tego dnia była dostawa. Na koniec próg minimalny
    liczy się tak samo jak w aplikacji – z zużycia w produkcji z ostatnich 7 dni.
    """
    rng = random.Random(2026)
    now = timezone.now()
    real = _real_usage()
    real_from = min((day for days in real.values() for day in days), default=None)
    with_history = set(StockMovement.objects.values_list('ingredient_id', flat=True).distinct())
    movements = []
    for name, _unit, typical, cover_days in INGREDIENT_DATA:
        ingredient = ingredients[name]
        if ingredient.pk in with_history:
            continue
        real_days = real.get(ingredient.pk)
        used_by_day = []
        for day in date_range:
            if real_days and day >= real_from:
                used = real_days.get(day, Decimal('0'))
            else:
                noise = Decimal(str(round(rng.uniform(0.85, 1.15), 2)))
                used = (typical * WEEKDAY_USAGE[day.weekday()] * noise).quantize(Decimal('0.001'))
            used_by_day.append((day, used))

        weekly = sum((used for _, used in used_by_day[-7:]), Decimal('0'))
        daily = weekly / 7
        step = _step(weekly)
        final = (daily * cover_days).quantize(Decimal('0.1') if step >= 1 else Decimal('0.001'))
        ceiling = final + daily * Decimal(str(round(rng.uniform(4, 10), 1)))
        ceiling = max(ceiling, daily * 12)

        balance = final
        for day, used in reversed(used_by_day):
            if used > 0:
                movements.append(StockMovement(
                    ingredient=ingredient, kind=StockMovement.KIND_PRODUCTION, quantity=-used,
                    balance_after=balance,
                    created_at=min(_moment(day, PRODUCTION_HOUR), now - timedelta(minutes=5)),
                ))
                balance += used
            if balance > ceiling and day != date_range[0]:
                target = daily * Decimal(str(round(rng.uniform(4, 8), 1)))
                delivered = ((balance - target) / step).to_integral_value(rounding=ROUND_DOWN) * step
                if delivered > 0:
                    movements.append(StockMovement(
                        ingredient=ingredient, kind=StockMovement.KIND_DELIVERY, quantity=delivered,
                        balance_after=balance, created_by=user, created_at=_moment(day, DELIVERY_HOUR, 30),
                    ))
                    balance -= delivered
        movements.append(StockMovement(
            ingredient=ingredient, kind=StockMovement.KIND_INITIAL, quantity=balance,
            balance_after=balance, created_by=user, created_at=_moment(date_range[0], 6),
        ))
        IngredientStock.objects.filter(ingredient=ingredient).update(current_stock=final)
    StockMovement.objects.bulk_create(movements)
    recalculate_min_stock()
    return len(movements)
