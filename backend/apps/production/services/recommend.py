"""Rekomendacja ciasta dla wyrobu na podstawie jego receptury.

Dla każdego ciasta szuka takiej wagi kęsa w, przy której część z ciasta (skład na 1 kg x w)
mieści się w recepturze wyrobu. To, co zostaje ponad nią, to kandydaci na dodatki (ser, mak,
dodatkowe jajo do smarowania), więc dodatki nie psują dopasowania.

Zgodność = jaką część masy wspólnych surowców wyjaśnia ciasto, pomniejszona o udział surowców
ciasta, których w recepturze wyrobu brakuje. 1,0 oznacza, że wyrób to dokładnie to ciasto (+ dodatki).
"""
from decimal import ROUND_HALF_UP, Decimal

from products.models import Recipe

from ..models import Dough

# Przeliczenie na kilogramy: jajo bez skorupki ok. 50 g, 1 l ≈ 1 kg.
UNIT_MASS_KG = {'kg': Decimal('1'), 'l': Decimal('1'), 'szt': Decimal('0.05')}
# Receptura na sztukę ma 3 miejsca po przecinku — tyle może wynosić błąd zaokrąglenia.
ROUNDING_TOLERANCE_KG = Decimal('0.0005')
ADDITION_THRESHOLD_KG = Decimal('0.001')
GOOD_MATCH = Decimal('0.80')
MAX_SUGGESTIONS = 3


def _mass(amount, unit):
    factor = UNIT_MASS_KG.get(unit)
    return None if factor is None else amount * factor


def _product_masses(product):
    masses, ingredients = {}, {}
    for r in Recipe.objects.filter(product=product).select_related('ingredient'):
        mass = _mass(r.amount, r.ingredient.unit)
        if mass is not None and mass > 0:
            masses[r.ingredient_id] = mass
            ingredients[r.ingredient_id] = r.ingredient
    return masses, ingredients


def match_dough(product_masses, dough_masses):
    """(zgodność 0..1, waga kęsa w kg, nadwyżki {ingredient_id: kg}, brakujące ingredient_id)."""
    present = {i: d for i, d in dough_masses.items() if i in product_masses}
    missing = [i for i in dough_masses if i not in product_masses]
    if not present:
        return Decimal('0'), Decimal('0'), dict(product_masses), missing

    # Największy kęs, którego część z ciasta mieści się w recepturze (z tolerancją na zaokrąglenia).
    upper = min((product_masses[i] + ROUNDING_TOLERANCE_KG) / d for i, d in present.items())
    # Dopracowanie na surowcach bez dodatków: tam część z ciasta powinna równać się recepturze.
    exact = {i: d for i, d in present.items() if product_masses[i] - upper * d <= ADDITION_THRESHOLD_KG}
    weight = upper
    if exact:
        weight = sum(product_masses[i] * d for i, d in exact.items()) / sum(d * d for d in exact.values())
        weight = min(weight, upper)

    explained = weight * sum(present.values())
    shared_mass = sum(product_masses[i] for i in present)
    missing_share = sum(dough_masses[i] for i in missing) / sum(dough_masses.values())
    score = min(explained / shared_mass, Decimal('1')) * (1 - missing_share)

    surplus = {}
    for ingredient_id, mass in product_masses.items():
        extra = mass - weight * dough_masses.get(ingredient_id, Decimal('0'))
        if extra > ADDITION_THRESHOLD_KG or (ingredient_id not in dough_masses and extra > 0):
            surplus[ingredient_id] = extra
    return score, weight, surplus, missing


def recommend_doughs(product):
    product_masses, ingredients = _product_masses(product)
    suggestions = []
    if product_masses:
        for dough in Dough.objects.prefetch_related('dough_ingredients__ingredient'):
            dough_masses = {}
            for item in dough.dough_ingredients.all():
                mass = _mass(item.amount_per_kg, item.ingredient.unit)
                if mass is not None:
                    dough_masses[item.ingredient_id] = mass
                    ingredients.setdefault(item.ingredient_id, item.ingredient)
            if not dough_masses:
                continue
            score, weight, surplus, missing = match_dough(product_masses, dough_masses)
            suggestions.append((score, dough, weight, surplus, missing))
    suggestions.sort(key=lambda entry: (-entry[0], entry[1].name))

    def amount_in_unit(ingredient_id, mass):
        return (mass / UNIT_MASS_KG[ingredients[ingredient_id].unit]).quantize(Decimal('0.001'), rounding=ROUND_HALF_UP)

    return {
        'product_id': product.product_id,
        'has_recipe': bool(product_masses),
        'good_match': GOOD_MATCH,
        'suggestions': [
            {
                'dough_id': dough.dough_id,
                'dough_name': dough.name,
                'score': score.quantize(Decimal('0.001'), rounding=ROUND_HALF_UP),
                'piece_weight_kg': weight.quantize(Decimal('0.001'), rounding=ROUND_HALF_UP),
                'additions': [
                    {
                        'ingredient_id': ingredient_id,
                        'name': ingredients[ingredient_id].name,
                        'unit': ingredients[ingredient_id].unit,
                        'amount': amount_in_unit(ingredient_id, mass),
                    }
                    for ingredient_id, mass in sorted(surplus.items(), key=lambda item: ingredients[item[0]].name)
                ],
                'missing': sorted(ingredients[i].name for i in missing),
            }
            for score, dough, weight, surplus, missing in suggestions[:MAX_SUGGESTIONS]
        ],
    }
