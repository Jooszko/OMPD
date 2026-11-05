"""Receptura wyrobu przypisanego do ciasta: część z ciasta + dodatki.

Ciasto jest wzorcem technologicznym (skład na 1 kg), a receptura produktu (Recipe, na sztukę)
jest z niego wyliczana:

    Recipe = skład ciasta na 1 kg x waga kęsa + dodatki (ProductAddition)

Recipe nie zawiera bufora strat — doliczają go finanse (common.losses). Wyroby bez ciasta mają
recepturę wpisywaną ręcznie, jak dotąd.
"""
from collections import defaultdict
from decimal import ROUND_HALF_UP, Decimal

from audit.services import field_changes, record_event
from products.models import ProductAddition, Recipe

from ..models import ProductBakeSpec

RECIPE_PRECISION = Decimal('0.001')


def _quantize(amount):
    """Ilość na sztukę do 3 miejsc; dodatnia ilość nie znika przy zaokrągleniu (np. sól w bułce)."""
    return max(amount.quantize(RECIPE_PRECISION, rounding=ROUND_HALF_UP), RECIPE_PRECISION)


def bake_spec_of(product):
    return ProductBakeSpec.objects.select_related('dough').prefetch_related('dough__dough_ingredients').filter(
        product=product
    ).first()


def dough_part(spec):
    """{ingredient_id: ilość na sztukę} pochodząca z ciasta, bez zaokrągleń."""
    return {
        item.ingredient_id: item.amount_per_kg * spec.piece_weight_kg
        for item in spec.dough.dough_ingredients.all()
    }


def additions_of(product):
    return {a.ingredient_id: a.amount for a in ProductAddition.objects.filter(product=product)}


def compose(part, additions):
    """Receptura na sztukę: część z ciasta + dodatki, zaokrąglona do 3 miejsc."""
    total = defaultdict(Decimal)
    for source in (part, additions):
        for ingredient_id, amount in source.items():
            total[ingredient_id] += amount
    return {ingredient_id: _quantize(amount) for ingredient_id, amount in total.items() if amount > 0}


def surplus_over_dough(recipe, part):
    """Dodatki odczytane z ręcznej receptury: to, co jest w niej ponad część z ciasta.

    Dla surowców z ciasta różnica do 0,001 to błąd zaokrąglenia, a nie dodatek.
    Ilości mniejsze niż część z ciasta pomija się — po przeliczeniu receptura dostaje pełną część z ciasta.
    """
    additions = {}
    for ingredient_id, amount in recipe.items():
        extra = amount - part.get(ingredient_id, Decimal('0'))
        tolerance = RECIPE_PRECISION if ingredient_id in part else Decimal('0')
        if extra > tolerance:
            additions[ingredient_id] = extra.quantize(RECIPE_PRECISION, rounding=ROUND_HALF_UP)
    return {ingredient_id: amount for ingredient_id, amount in additions.items() if amount > 0}


def _recipe_state(product):
    return {
        r.ingredient.name: f'{r.amount} {r.ingredient.unit}'
        for r in Recipe.objects.filter(product=product).select_related('ingredient')
    }


def _write_recipe(product, amounts):
    Recipe.objects.filter(product=product).delete()
    Recipe.objects.bulk_create([
        Recipe(product=product, ingredient_id=ingredient_id, amount=amount)
        for ingredient_id, amount in amounts.items()
    ])


def set_additions(product, amounts):
    """Zastępuje dodatki wyrobu: {ingredient_id: ilość na sztukę}."""
    ProductAddition.objects.filter(product=product).delete()
    ProductAddition.objects.bulk_create([
        ProductAddition(product=product, ingredient_id=ingredient_id, amount=amount)
        for ingredient_id, amount in amounts.items()
        if amount > 0
    ])


def rebuild_recipe(product, request=None, reason='', action='recipe.recalculated', description=None):
    """Odtwarza Recipe wyrobu z ciasta i dodatków. Zwraca True, gdy receptura się zmieniła.

    Wołać w transakcji. Każda zmiana receptury trafia do dziennika zmian.
    """
    spec = bake_spec_of(product)
    if spec is None:
        return False
    amounts = compose(dough_part(spec), additions_of(product))
    current = {r.ingredient_id: r.amount for r in Recipe.objects.filter(product=product)}
    if amounts == current:
        return False
    before = _recipe_state(product)
    _write_recipe(product, amounts)
    after = _recipe_state(product)
    record_event(
        request, category='products', action=action, obj=product, object_label=product.name,
        description=description or f'Przeliczono recepturę produktu {product.name} z ciasta {spec.dough.name}{reason}.',
        changes=field_changes(before, after, {name: name for name in sorted(set(before) | set(after))}),
    )
    return True


def adopt_dough(product, request=None):
    """Wyrób dostał ciasto po raz pierwszy: to, co w ręcznej recepturze jest ponad ciasto, staje się dodatkami."""
    spec = bake_spec_of(product)
    current = {r.ingredient_id: r.amount for r in Recipe.objects.filter(product=product)}
    set_additions(product, surplus_over_dough(current, dough_part(spec)))
    return rebuild_recipe(product, request, reason=' (przypisanie do ciasta)')


def release_dough(product):
    """Wyrób odłączony od ciasta: receptura zostaje jako ręczna, a dodatki są już jej częścią."""
    ProductAddition.objects.filter(product=product).delete()


def rebuild_for_dough(dough, request=None):
    """Po zmianie składu ciasta przelicza receptury wszystkich jego wyrobów."""
    changed = 0
    for spec in dough.bake_specs.select_related('product'):
        changed += rebuild_recipe(spec.product, request, reason=' (zmiana składu ciasta)')
    return changed


def dough_is_locked(dough):
    """Skład ciasta użytego w produkcji jest zablokowany — dawne dzieże i koszty opierają się na nim."""
    return dough.batches.exists()


def recipe_breakdown(product):
    """Do ekranu receptury: część z ciasta (tylko do odczytu) i dodatki (edytowalne)."""
    spec = bake_spec_of(product)
    if spec is None:
        return None
    return {
        'dough_id': spec.dough_id,
        'dough_name': spec.dough.name,
        'piece_weight_kg': spec.piece_weight_kg,
        'dough_items': {ingredient_id: _quantize(amount) for ingredient_id, amount in dough_part(spec).items()},
        'additions': additions_of(product),
    }
