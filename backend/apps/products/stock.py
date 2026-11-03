"""Stany magazynowe surowców: ruchy, zestawienie magazynu i historia stanu do wykresu.

Próg minimalny nie jest wpisywany ręcznie: to suma zużycia surowca w produkcji z ostatnich
7 dni, czyli zapas na tydzień przy obecnym tempie. Średnie dzienne zużycie to ta suma / 7.
"""
from collections import defaultdict
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.db.models import Max, Sum
from django.utils import timezone

from finance.models import SupplierIngredient

from .models import Ingredient, IngredientStock, StockMovement

USAGE_WINDOW_DAYS = 7
CONSUMPTION_KINDS = (StockMovement.KIND_PRODUCTION, StockMovement.KIND_LOSS)
MANUAL_KINDS = (StockMovement.KIND_DELIVERY, StockMovement.KIND_LOSS, StockMovement.KIND_COUNT)
THOUSANDTH = Decimal('0.001')
CENT = Decimal('0.01')


class StockError(Exception):
    """Zmiana stanu niemożliwa, np. rozchód większy niż stan."""


def record_movement(ingredient_id, kind, quantity, *, user=None, note='', at=None):
    """Zmienia stan surowca o `quantity` (ze znakiem) i zapisuje ruch. Wołać w transakcji."""
    stock, _ = IngredientStock.objects.select_for_update().get_or_create(ingredient_id=ingredient_id)
    stock.current_stock += quantity
    stock.save(update_fields=['current_stock', 'updated_at'])
    return StockMovement.objects.create(
        ingredient_id=ingredient_id,
        kind=kind,
        quantity=quantity,
        balance_after=stock.current_stock,
        note=note,
        created_by=user,
        created_at=at or timezone.now(),
    )


def weighted_price(stock, amount, unit_price):
    held = max(stock.current_stock, Decimal('0'))
    if stock.current_price is None or held == 0:
        return unit_price.quantize(CENT)
    return ((held * stock.current_price + amount * unit_price) / (held + amount)).quantize(CENT)


def adjust_stock(ingredient, kind, amount, *, user, note='', unit_price=None):
    """Ręczna zmiana z magazynu: przyjęcie, rozchód albo stan z inwentaryzacji."""
    if kind not in MANUAL_KINDS:
        raise StockError('Nieznany rodzaj zmiany stanu.')
    stock, _ = IngredientStock.objects.select_for_update().get_or_create(ingredient=ingredient)
    if kind == StockMovement.KIND_COUNT:
        delta = amount - stock.current_stock
    elif amount <= 0:
        raise StockError('Ilość musi być większa od zera.')
    elif kind == StockMovement.KIND_LOSS:
        if amount > stock.current_stock:
            raise StockError(
                f'Na stanie jest tylko {stock.current_stock.normalize():f} {ingredient.unit}. '
                'Jeśli stan jest inny, zrób inwentaryzację.'
            )
        delta = -amount
    else:
        delta = amount
    movement = record_movement(ingredient.pk, kind, delta, user=user, note=note)
    if kind == StockMovement.KIND_DELIVERY and unit_price is not None:
        IngredientStock.objects.filter(pk=ingredient.pk).update(
            current_price=weighted_price(stock, amount, unit_price)
        )
    return movement


def weekly_usage(ingredient_ids=None):
    """Zużycie w produkcji z ostatnich 7 dni: {ingredient_id: ilość (dodatnia)}."""
    now = timezone.now()
    movements = StockMovement.objects.filter(
        kind=StockMovement.KIND_PRODUCTION,
        created_at__gt=now - timedelta(days=USAGE_WINDOW_DAYS),
        created_at__lte=now,
    )
    if ingredient_ids is not None:
        movements = movements.filter(ingredient_id__in=ingredient_ids)
    totals = movements.values('ingredient_id').annotate(total=Sum('quantity')).values_list('ingredient_id', 'total')
    return {ingredient_id: -total for ingredient_id, total in totals}


def recalculate_min_stock(ingredient_ids=None):
    """Ustawia próg minimalny na sumę zużycia z ostatnich 7 dni. Zwraca liczbę zmienionych surowców."""
    usage = weekly_usage(ingredient_ids)
    stocks = IngredientStock.objects.all()
    if ingredient_ids is not None:
        stocks = stocks.filter(ingredient_id__in=ingredient_ids)
    changed = []
    for stock in stocks:
        minimum = usage.get(stock.ingredient_id, Decimal('0')).quantize(THOUSANDTH)
        if stock.min_stock_level != minimum:
            stock.min_stock_level = minimum
            changed.append(stock)
    IngredientStock.objects.bulk_update(changed, ['min_stock_level'])
    return len(changed)


def _iso(value):
    return value.isoformat() if value else None


def delivery_offers(ingredient_ids=None):
    offers = (
        SupplierIngredient.objects
        .filter(is_assigned=True, supplier__is_active=True)
        .select_related('supplier')
        .order_by('supplier__name')
    )
    if ingredient_ids is not None:
        offers = offers.filter(ingredient_id__in=ingredient_ids)
    result = defaultdict(list)
    for offer in offers:
        result[offer.ingredient_id].append({
            'supplier_id': offer.supplier_id,
            'name': offer.supplier.name,
            'price': str(offer.last_price) if offer.last_price is not None else None,
        })
    return result


def warehouse_rows(ingredient_ids=None):
    """Surowce ze stanem, progiem, średnim dziennym zużyciem z 7 dni i zapasem w dniach."""
    movements = StockMovement.objects.all()
    ingredients = Ingredient.objects.select_related('stock').order_by('name')
    if ingredient_ids is not None:
        movements = movements.filter(ingredient_id__in=ingredient_ids)
        ingredients = ingredients.filter(pk__in=ingredient_ids)

    usage = weekly_usage(ingredient_ids)
    offers = delivery_offers(ingredient_ids)
    last_delivery = dict(
        movements.filter(kind=StockMovement.KIND_DELIVERY)
        .values('ingredient_id').annotate(last=Max('created_at')).values_list('ingredient_id', 'last')
    )

    rows = []
    for ingredient in ingredients:
        stock = getattr(ingredient, 'stock', None)
        current = stock.current_stock if stock else Decimal('0')
        minimum = stock.min_stock_level if stock else Decimal('0')
        price = stock.current_price if stock else None
        daily_usage = (usage.get(ingredient.pk, Decimal('0')) / USAGE_WINDOW_DAYS).quantize(THOUSANDTH)
        days_left = round(float(max(current, Decimal('0')) / daily_usage), 1) if daily_usage > 0 else None
        rows.append({
            'ingredient_id': ingredient.pk,
            'name': ingredient.name,
            'unit': ingredient.unit,
            'current_stock': str(current),
            'min_stock_level': str(minimum),
            'daily_usage': str(daily_usage),
            'days_left': days_left,
            'last_delivery_at': _iso(last_delivery.get(ingredient.pk)),
            'updated_at': _iso(stock.updated_at if stock else None),
            'current_price': str(price) if price is not None else None,
            'suppliers': offers.get(ingredient.pk, []),
        })
    return rows


def warehouse_row(ingredient):
    return warehouse_rows([ingredient.pk])[0]


def stock_history(ingredient, days):
    """Stan na koniec każdego dnia z ostatnich `days` dni (nie wcześniej niż od dodania surowca) i ruchy z tego okresu."""
    today = timezone.localdate()
    start = today - timedelta(days=days - 1)
    created = ingredient.movements.filter(kind=StockMovement.KIND_INITIAL).order_by('created_at').first()
    if created:
        start = max(start, timezone.localdate(created.created_at))
    days = (today - start).days + 1
    start_at = timezone.make_aware(datetime.combine(start, time.min))
    movements = list(
        ingredient.movements.filter(created_at__gte=start_at).select_related('created_by')
    )
    stock = getattr(ingredient, 'stock', None)
    current = stock.current_stock if stock else Decimal('0')
    balance = current - sum((m.quantity for m in movements), Decimal('0'))

    by_day = defaultdict(lambda: {'received': Decimal('0'), 'used': Decimal('0'), 'corrected': Decimal('0')})
    for movement in movements:
        day = by_day[timezone.localdate(movement.created_at)]
        if movement.kind == StockMovement.KIND_DELIVERY:
            day['received'] += movement.quantity
        elif movement.kind in CONSUMPTION_KINDS:
            day['used'] -= movement.quantity
        else:
            day['corrected'] += movement.quantity

    series = []
    for offset in range(days):
        date = start + timedelta(days=offset)
        day = by_day.get(date)
        if day:
            balance += day['received'] - day['used'] + day['corrected']
        series.append({
            'date': date.isoformat(),
            'balance': str(balance),
            'received': str(day['received'] if day else Decimal('0')),
            'used': str(day['used'] if day else Decimal('0')),
            'corrected': str(day['corrected'] if day else Decimal('0')),
        })

    recent = [
        {
            'movement_id': m.movement_id,
            'kind': m.kind,
            'quantity': str(m.quantity),
            'balance_after': str(m.balance_after),
            'note': m.note,
            'created_at': m.created_at.isoformat(),
            'created_by_name': m.created_by.full_name if m.created_by else '',
        }
        for m in reversed(movements[-40:])
    ]
    return {'days': days, 'series': series, 'movements': recent}
