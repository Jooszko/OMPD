from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

from django.db.models import DecimalField, ExpressionWrapper, F, Sum

from orders.models import DailyOrder, ProductReturn
from products.models import IngredientStock, Recipe, StockMovement

from .models import Expense

ZERO = Decimal('0')
MONEY = DecimalField(max_digits=12, decimal_places=2)
COGS_STATUSES = ['planned', 'in_production', 'in_delivery', 'delivered', 'failed']
STOCK_LOSS_KINDS = [StockMovement.KIND_LOSS, StockMovement.KIND_COUNT]
LOSS_BUFFER = Decimal('1.05')


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
    return dict(
        IngredientStock.objects
        .exclude(current_price__isnull=True)
        .values_list('ingredient_id', 'current_price')
    )


def cogs_by_day(start, end, prices):
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
        cogs[row['product__daily_orders__order_date']] += row['total_amount'] * price * LOSS_BUFFER
    return {day: amount.quantize(Decimal('0.01')) for day, amount in cogs.items()}


def stock_losses_by_day(start, end, prices):
    rows = (
        StockMovement.objects
        .filter(kind__in=STOCK_LOSS_KINDS, created_at__date__range=(start, end))
        .values('created_at__date', 'ingredient_id')
        .annotate(total=Sum('quantity'))
    )
    losses = defaultdict(lambda: ZERO)
    for row in rows:
        price = prices.get(row['ingredient_id']) or ZERO
        losses[row['created_at__date']] -= row['total'] * price
    return {day: amount.quantize(Decimal('0.01')) for day, amount in losses.items()}


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
    prices = ingredient_prices()
    sales = sales_by_day(start, end)
    returns = returns_by_day(start, end)
    materials = cogs_by_day(start, end, prices)
    stock_losses = stock_losses_by_day(start, end, prices)
    expenses = expenses_by_day_and_category(start, end)

    results = []
    for day in days_between(start, end):
        day_expenses = expenses.get(day, {})
        operating = sum(day_expenses.values(), ZERO)
        revenue = sales.get(day, ZERO) - returns.get(day, ZERO)
        day_materials = materials.get(day, ZERO)
        day_losses = stock_losses.get(day, ZERO)
        day_cogs = day_materials + day_losses
        results.append({
            'date': day,
            'sales': sales.get(day, ZERO),
            'returns': returns.get(day, ZERO),
            'revenue': revenue,
            'materials': day_materials,
            'stock_losses': day_losses,
            'cogs': day_cogs,
            'operating_expenses': operating,
            'expenses_by_category': day_expenses,
            'net_profit': revenue - day_cogs - operating,
        })
    return results


def period_totals(results):
    keys = ('sales', 'returns', 'revenue', 'materials', 'stock_losses', 'cogs', 'operating_expenses', 'net_profit')
    totals = {key: sum((day[key] for day in results), ZERO) for key in keys}
    by_category = defaultdict(lambda: ZERO)
    for day in results:
        for category, amount in day['expenses_by_category'].items():
            by_category[category] += amount
    totals['expenses_by_category'] = dict(by_category)
    return totals