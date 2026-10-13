from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

from django.db.models import Avg, DecimalField, ExpressionWrapper, F, Sum

from orders.models import DailyOrder, ProductReturn
from products.models import Recipe

from .models import Expense, SupplierIngredient

ZERO = Decimal('0')
MONEY = DecimalField(max_digits=12, decimal_places=2)
COGS_STATUSES = ['planned', 'in_production', 'in_delivery', 'delivered', 'failed']


def days_between(start, end):
    return [start + timedelta(days=offset) for offset in range((end - start).days + 1)]


def sales_by_day(start, end):
    rows = (
        DailyOrder.objects
        .filter(order_date__range=(start, end))
        .exclude(status__in=DailyOrder.NON_REVENUE_STATUSES)
        .values('order_date')
        .annotate(total=Sum(ExpressionWrapper(F('quantity') * F('price_at_sale'), output_field=MONEY)))
    )
    return {row['order_date']: row['total'] for row in rows}


def returns_by_day(start, end):
    rows = (
        ProductReturn.objects
        .filter(return_date__range=(start, end))
        .values('return_date')
        .annotate(total=Sum(ExpressionWrapper(F('quantity') * F('unit_price'), output_field=MONEY)))
    )
    return {row['return_date']: row['total'] for row in rows}


def ingredient_prices():
    """Average last purchase price of each ingredient across its suppliers."""
    return dict(
        SupplierIngredient.objects
        .exclude(last_price__isnull=True)
        .values('ingredient_id')
        .annotate(avg_price=Avg('last_price'))
        .values_list('ingredient_id', 'avg_price')
    )


def cogs_by_day(start, end):
    prices = ingredient_prices()
    usage = (
        Recipe.objects
        .filter(
            product__daily_orders__order_date__range=(start, end),
            product__daily_orders__status__in=COGS_STATUSES,
        )
        .values('product__daily_orders__order_date', 'ingredient_id')
        .annotate(total_amount=Sum(ExpressionWrapper(
            F('amount') * F('product__daily_orders__quantity'),
            output_field=DecimalField(max_digits=14, decimal_places=3),
        )))
    )
    cogs = defaultdict(lambda: ZERO)
    for row in usage:
        price = prices.get(row['ingredient_id']) or ZERO
        cogs[row['product__daily_orders__order_date']] += row['total_amount'] * price
    return {day: amount.quantize(Decimal('0.01')) for day, amount in cogs.items()}


def expenses_by_day_and_category(start, end):
    rows = (
        Expense.objects
        .filter(date__range=(start, end))
        .values('date', 'category')
        .annotate(total=Sum('amount'))
    )
    result = defaultdict(dict)
    for row in rows:
        result[row['date']][row['category']] = row['total']
    return result


def daily_results(start, end):
    """One entry per day: revenue (sales − returns), COGS, operating expenses and net profit."""
    sales = sales_by_day(start, end)
    returns = returns_by_day(start, end)
    cogs = cogs_by_day(start, end)
    expenses = expenses_by_day_and_category(start, end)

    results = []
    for day in days_between(start, end):
        day_expenses = expenses.get(day, {})
        operating = sum(day_expenses.values(), ZERO)
        revenue = sales.get(day, ZERO) - returns.get(day, ZERO)
        day_cogs = cogs.get(day, ZERO)
        results.append({
            'date': day,
            'sales': sales.get(day, ZERO),
            'returns': returns.get(day, ZERO),
            'revenue': revenue,
            'cogs': day_cogs,
            'operating_expenses': operating,
            'expenses_by_category': day_expenses,
            'net_profit': revenue - day_cogs - operating,
        })
    return results


def period_totals(results):
    keys = ('sales', 'returns', 'revenue', 'cogs', 'operating_expenses', 'net_profit')
    totals = {key: sum((day[key] for day in results), ZERO) for key in keys}
    by_category = defaultdict(lambda: ZERO)
    for day in results:
        for category, amount in day['expenses_by_category'].items():
            by_category[category] += amount
    totals['expenses_by_category'] = dict(by_category)
    return totals