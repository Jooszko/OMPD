"""Rekomendacja ciasta dla wyrobu na podstawie jego receptury.

Dla każdego ciasta szuka wagi kęsa w (najmniejsze kwadraty po masie surowców wspólnych), przy której
skład ciasta na 1 kg x w najlepiej odtwarza recepturę wyrobu. Potem ocenia każdy surowiec osobno:

- surowiec ciasta i receptury: 1, gdy ilości się zgadzają, malejąco do 0 przy różnicy MAX_DEVIATION,
- surowiec ciasta, którego nie ma w recepturze: 0,
- surowiec receptury spoza ciasta, który w piekarni pełni rolę surowca ciasta (mąka, jaja, mleko…): 0 —
  ciasto go nie daje, a dodatkiem być nie powinien,
- surowiec receptury spoza ciasta w roli dodatku (konfitura, mak, ser): dodatek, nie wpływa na ocenę.

Rolę surowca rozstrzyga większość jego użyć: jest surowcem ciasta, gdy występuje w większej liczbie ciast niż
dodatków wyrobów (przy remisie — dodatek). Dzięki temu jedno ciasto z makiem nie robi z maku surowca ciasta.

Ocena surowców wspólnych to średnia dwóch średnich: zwykłej (sól i drożdże ważą tyle co mąka) i ważonej masą
(pomyłka w mące waży więcej niż w soli). Zgodność to ta ocena pomnożona przez kwadrat pokrycia (udział
surowców wspólnych wśród ocenianych), więc brak surowca waży więcej niż różnica ilości.
1,0 oznacza, że wyrób to dokładnie to ciasto (+ dodatki).
"""
from decimal import ROUND_HALF_UP, Decimal

from collections import Counter

from products.models import ProductAddition, Recipe

from ..models import Dough

# Przeliczenie na kilogramy (do wyznaczenia wagi kęsa): jajo bez skorupki ok. 50 g, 1 l ≈ 1 kg.
UNIT_MASS_KG = {'kg': Decimal('1'), 'l': Decimal('1'), 'szt': Decimal('0.05')}
# Receptura na sztukę ma 3 miejsca po przecinku — tyle może wynosić błąd zaokrąglenia (w jednostce surowca).
ROUNDING_TOLERANCE = Decimal('0.0005')
RECIPE_MINIMUM = Decimal('0.001')
# Różnica ilości (względem większej z nich), przy której surowiec uznaje się za niezgodny.
MAX_DEVIATION = Decimal('0.20')
# Od jakiej różnicy ilości surowiec jest pokazywany jako „inna ilość” (drobne różnice nie są ostrzeżeniem).
MISMATCH_DEVIATION = Decimal('0.05')
GOOD_MATCH = Decimal('0.80')
MAX_SUGGESTIONS = 3


def _ingredient_accuracy(actual, expected):
    """1 przy zgodnej ilości, 0 przy różnicy MAX_DEVIATION i większej; ilości w jednostce surowca."""
    # Receptura zaokrągla do 0,001 i nie zapisuje mniej niż 0,001 (np. sól w małej bułce).
    expected = max(expected, RECIPE_MINIMUM)
    difference = max(abs(actual - expected) - ROUNDING_TOLERANCE, Decimal('0'))
    deviation = difference / max(actual, expected)
    return max(Decimal('1') - deviation / MAX_DEVIATION, Decimal('0'))


MISMATCH_ACCURACY = 1 - MISMATCH_DEVIATION / MAX_DEVIATION


def match_dough(product_amounts, dough_amounts, units, dough_like=frozenset()):
    """Dopasowanie receptury wyrobu (na sztukę) do ciasta (na 1 kg).

    units: {ingredient_id: jednostka}, dough_like: surowce w roli surowca ciasta (zob. dough_like_ingredients).
    Zwraca słownik: score, weight, additions, foreign, mismatched, missing.
    """
    shared = [i for i in dough_amounts if i in product_amounts]
    missing = [i for i in dough_amounts if i not in product_amounts]
    outside = [i for i in product_amounts if i not in dough_amounts]
    foreign = [i for i in outside if i in dough_like]
    additions = {i: product_amounts[i] for i in outside if i not in dough_like}

    weight = Decimal('0')
    mismatched = []
    accuracies = {}
    if shared:
        mass = {i: UNIT_MASS_KG[units[i]] for i in shared}
        weight = (
            sum(product_amounts[i] * dough_amounts[i] * mass[i] ** 2 for i in shared)
            / sum((dough_amounts[i] * mass[i]) ** 2 for i in shared)
        )
        for i in shared:
            accuracy = _ingredient_accuracy(product_amounts[i], weight * dough_amounts[i])
            accuracies[i] = accuracy
            if accuracy < MISMATCH_ACCURACY:
                mismatched.append(i)

    judged = len(shared) + len(missing) + len(foreign)
    score = Decimal('0')
    if shared:
        # Brak surowca to inna receptura, a nie drobna różnica — pokrycie liczy się podwójnie.
        coverage = Decimal(len(shared)) / judged
        plain = sum(accuracies.values()) / len(shared)
        masses = {i: product_amounts[i] * mass[i] for i in shared}
        total_mass = sum(masses.values())
        weighted = sum(accuracies[i] * masses[i] for i in shared) / total_mass if total_mass else plain
        score = (plain + weighted) / 2 * coverage * coverage
    return {
        'score': score,
        'weight': weight,
        'additions': additions,
        'foreign': foreign,
        'mismatched': mismatched,
        'missing': missing,
    }


def dough_like_ingredients(doughs):
    """Surowce, które częściej wchodzą do ciast niż do dodatków wyrobów; przy remisie przeważa rola dodatku."""
    in_doughs = Counter(item.ingredient_id for dough in doughs for item in dough.dough_ingredients.all())
    as_additions = Counter(ProductAddition.objects.values_list('ingredient_id', flat=True))
    return frozenset(i for i, count in in_doughs.items() if count > as_additions[i])


def recommend_doughs(product):
    product_amounts, ingredients = {}, {}
    for r in Recipe.objects.filter(product=product).select_related('ingredient'):
        if r.amount > 0 and r.ingredient.unit in UNIT_MASS_KG:
            product_amounts[r.ingredient_id] = r.amount
            ingredients[r.ingredient_id] = r.ingredient
    doughs = list(Dough.objects.prefetch_related('dough_ingredients__ingredient'))
    dough_like = dough_like_ingredients(doughs)

    suggestions = []
    if product_amounts:
        for dough in doughs:
            dough_amounts = {}
            for item in dough.dough_ingredients.all():
                if item.ingredient.unit in UNIT_MASS_KG:
                    dough_amounts[item.ingredient_id] = item.amount_per_kg
                    ingredients.setdefault(item.ingredient_id, item.ingredient)
            if not dough_amounts:
                continue
            units = {i: ingredients[i].unit for i in set(product_amounts) | set(dough_amounts)}
            suggestions.append((dough, match_dough(product_amounts, dough_amounts, units, dough_like)))
    suggestions.sort(key=lambda entry: (-entry[1]['score'], entry[0].name))

    def names(ids):
        return sorted(ingredients[i].name for i in ids)

    return {
        'product_id': product.product_id,
        'has_recipe': bool(product_amounts),
        'good_match': GOOD_MATCH,
        'suggestions': [
            {
                'dough_id': dough.dough_id,
                'dough_name': dough.name,
                'score': match['score'].quantize(Decimal('0.001'), rounding=ROUND_HALF_UP),
                'piece_weight_kg': match['weight'].quantize(Decimal('0.001'), rounding=ROUND_HALF_UP),
                'additions': [
                    {
                        'ingredient_id': ingredient_id,
                        'name': ingredients[ingredient_id].name,
                        'unit': ingredients[ingredient_id].unit,
                        'amount': amount,
                    }
                    for ingredient_id, amount in sorted(
                        match['additions'].items(), key=lambda item: ingredients[item[0]].name
                    )
                ],
                'foreign': names(match['foreign']),
                'mismatched': names(match['mismatched']),
                'missing': names(match['missing']),
            }
            for dough, match in suggestions[:MAX_SUGGESTIONS]
        ],
    }
