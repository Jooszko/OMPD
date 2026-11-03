from collections import defaultdict
from decimal import Decimal

from django.db.models import ExpressionWrapper, F, Sum

from orders.models import DailyOrder, ProductReturn
from products.models import Product, Recipe

from .calculations import COGS_STATUSES, MONEY, ZERO, ingredient_prices
from .overview import money

SALE_VALUE = ExpressionWrapper(F('quantity') * F('price_at_sale'), output_field=MONEY)
RETURN_VALUE = ExpressionWrapper(F('quantity') * F('unit_price'), output_field=MONEY)
CENT = Decimal('0.01')


def _sum_by_product(queryset, **sums):
    rows = queryset.values('product_id').annotate(**sums)
    return {row['product_id']: row for row in rows}


def _recipes():
    """{product_id: [(ingredient, amount per piece)]} for every product that has a recipe."""
    recipes = defaultdict(list)
    for recipe in Recipe.objects.select_related('ingredient'):
        recipes[recipe.product_id].append((recipe.ingredient, recipe.amount))
    return recipes


def _unit_cost(recipe, prices):
    cost = ZERO
    missing = []
    for ingredient, amount in recipe:
        price = prices.get(ingredient.ingredient_id)
        if price is None:
            missing.append(ingredient.name)
        else:
            cost += amount * price
    return cost.quantize(CENT), missing


def build_profitability(start, end):
    prices = ingredient_prices()
    recipes = _recipes()
    orders = DailyOrder.objects.filter(order_date__range=(start, end))
    sales = _sum_by_product(
        orders.exclude(status__in=DailyOrder.NON_REVENUE_STATUSES),
        pieces=Sum('quantity'), value=Sum(SALE_VALUE),
    )
    baked = _sum_by_product(orders.filter(status__in=COGS_STATUSES), pieces=Sum('quantity'))
    returns = _sum_by_product(
        ProductReturn.objects.filter(return_date__range=(start, end)),
        pieces=Sum('quantity'), value=Sum(RETURN_VALUE),
    )

    products = []
    for product in Product.objects.order_by('name'):
        recipe = recipes.get(product.product_id)
        unit_cost, missing = _unit_cost(recipe, prices) if recipe else (None, [])
        sale = sales.get(product.product_id, {})
        returned = returns.get(product.product_id, {})
        revenue = (sale.get('value') or ZERO) - (returned.get('value') or ZERO)
        baked_quantity = baked.get(product.product_id, {}).get('pieces') or 0
        cogs = unit_cost * baked_quantity if unit_cost is not None else None
        unit_margin = product.base_price - unit_cost if unit_cost is not None else None
        products.append({
            'product_id': product.product_id,
            'name': product.name,
            'category_label': product.get_category_display(),
            'price': money(product.base_price),
            'unit_cost': money(unit_cost) if unit_cost is not None else None,
            'unit_margin': money(unit_margin) if unit_margin is not None else None,
            'margin_pct': (
                round(float(unit_margin / product.base_price * 100), 1)
                if unit_margin is not None and product.base_price > 0 else None
            ),
            'sold': (sale.get('pieces') or 0) - (returned.get('pieces') or 0),
            'revenue': money(revenue),
            'period_margin': money(revenue - cogs) if cogs is not None else None,
            'has_recipe': recipe is not None,
            'missing_prices': missing,
        })

    complete = [p for p in products if p['has_recipe'] and not p['missing_prices']]
    revenue = sum((Decimal(p['revenue']) for p in complete), ZERO)
    margin = sum((Decimal(p['period_margin']) for p in complete), ZERO)
    return {
        'period': {'start': str(start), 'end': str(end)},
        'average_margin_pct': round(float(margin / revenue * 100), 1) if revenue > 0 else None,
        'products': products,
        'missing_prices': _missing_prices(recipes, prices),
    }


def _missing_prices(recipes, prices):
    used_in = defaultdict(set)
    ingredients = {}
    for product in Product.objects.filter(product_id__in=recipes.keys()):
        for ingredient, _ in recipes[product.product_id]:
            if ingredient.ingredient_id not in prices:
                used_in[ingredient.ingredient_id].add(product.name)
                ingredients[ingredient.ingredient_id] = ingredient

    return [
        {
            'ingredient_id': ingredient_id,
            'name': ingredient.name,
            'unit': ingredient.unit,
            'products': sorted(used_in[ingredient_id]),
        }
        for ingredient_id, ingredient in sorted(ingredients.items(), key=lambda item: item[1].name)
    ]


def parse_price(value):
    try:
        price = Decimal(str(value).replace(',', '.'))
    except ArithmeticError:
        return None, 'Nieprawidłowa cena.'
    if not price.is_finite() or price <= 0:
        return None, 'Cena musi być większa od zera.'
    if price > Decimal('99999999.99'):
        return None, 'Cena jest za duża.'
    return price.quantize(CENT), None


def price_label(price, unit):
    return f'{price:.2f} zł/{unit}' if price is not None else None