from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, ExpressionWrapper, F, Q, Sum

from orders.models import DailyOrder, ProductReturn

from .calculations import MONEY, ZERO, daily_results, period_totals
from .models import Expense

TOP_CLIENTS = 5
RECENT_EXPENSES = 5
CATEGORY_LABELS = dict(Expense.CATEGORY_CHOICES)
TOTAL_KEYS = ('sales', 'returns', 'revenue', 'cogs', 'operating_expenses', 'net_profit')
SALE_VALUE = ExpressionWrapper(F('quantity') * F('price_at_sale'), output_field=MONEY)
RETURN_VALUE = ExpressionWrapper(F('quantity') * F('unit_price'), output_field=MONEY)


def money(value):
    return str(Decimal(value).quantize(Decimal('0.01')))


def previous_period(start, end):
    length = (end - start).days + 1
    return start - timedelta(days=length), start - timedelta(days=1)


def _client_revenue(start, end):
    """{client_id: {name, revenue, deliveries}} – revenue after returns, deliveries = days with a delivered order."""
    sales = (
        DailyOrder.objects
        .filter(order_date__range=(start, end))
        .exclude(status__in=DailyOrder.NON_REVENUE_STATUSES)
        .values('client_id', 'client__name')
        .annotate(
            total=Sum(SALE_VALUE),
            deliveries=Count('order_date', distinct=True, filter=Q(status='delivered')),
        )
    )
    returns = dict(
        ProductReturn.objects
        .filter(return_date__range=(start, end))
        .values('client_id')
        .annotate(total=Sum(RETURN_VALUE))
        .values_list('client_id', 'total')
    )
    return {
        row['client_id']: {
            'name': row['client__name'],
            'revenue': row['total'] - returns.get(row['client_id'], ZERO),
            'deliveries': row['deliveries'],
        }
        for row in sales
    }


def _top_clients(start, end, previous_start, previous_end, total_revenue):
    current = _client_revenue(start, end)
    previous = _client_revenue(previous_start, previous_end)
    ranked = sorted(current.items(), key=lambda item: item[1]['revenue'], reverse=True)
    top = [
        {
            'client_id': client_id,
            'name': data['name'],
            'revenue': money(data['revenue']),
            'previous_revenue': money(previous[client_id]['revenue']) if client_id in previous else None,
            'deliveries': data['deliveries'],
        }
        for client_id, data in ranked[:TOP_CLIENTS]
    ]
    top_revenue = sum((data['revenue'] for _, data in ranked[:TOP_CLIENTS]), ZERO)
    others = {
        'clients': max(len(ranked) - TOP_CLIENTS, 0),
        'revenue': money(total_revenue - top_revenue),
    }
    return top, others


def _cost_structure(current, previous):
    rows = [{
        'key': 'cogs',
        'label': 'Surowce',
        'group': 'cogs',
        'amount': money(current['cogs']),
        'previous': money(previous['cogs']),
    }]
    for category, label in Expense.CATEGORY_CHOICES:
        amount = current['expenses_by_category'].get(category, ZERO)
        before = previous['expenses_by_category'].get(category, ZERO)
        if amount or before:
            rows.append({
                'key': category,
                'label': label,
                'group': 'operating',
                'amount': money(amount),
                'previous': money(before),
            })
    return rows


def _recent_expenses(start, end):
    expenses = Expense.objects.filter(date__range=(start, end)).order_by('-date', '-expense_id')[:RECENT_EXPENSES]
    return [
        {
            'expense_id': expense.expense_id,
            'date': str(expense.date),
            'category': expense.category,
            'category_label': expense.get_category_display(),
            'description': expense.description,
            'amount': money(expense.amount),
        }
        for expense in expenses
    ]


def _daily(results):
    cumulative = ZERO
    days = []
    for day in results:
        cumulative += day['net_profit']
        days.append({
            'date': str(day['date']),
            'revenue': money(day['revenue']),
            'cogs': money(day['cogs']),
            'operating_expenses': money(day['operating_expenses']),
            'net_profit': money(day['net_profit']),
            'cumulative_profit': money(cumulative),
            'expenses': [
                {'category': category, 'label': CATEGORY_LABELS.get(category, category), 'amount': money(amount)}
                for category, amount in sorted(day['expenses_by_category'].items(), key=lambda item: -item[1])
            ],
        })
    return days


def build_overview(start, end):
    previous_start, previous_end = previous_period(start, end)
    current_days = daily_results(start, end)
    current = period_totals(current_days)
    previous = period_totals(daily_results(previous_start, previous_end))
    top_clients, other_clients = _top_clients(start, end, previous_start, previous_end, current['revenue'])
    return {
        'period': {
            'start': str(start),
            'end': str(end),
            'previous_start': str(previous_start),
            'previous_end': str(previous_end),
        },
        'totals': {key: money(current[key]) for key in TOTAL_KEYS},
        'previous_totals': {key: money(previous[key]) for key in TOTAL_KEYS},
        'daily': _daily(current_days),
        'cost_structure': _cost_structure(current, previous),
        'top_clients': top_clients,
        'other_clients': other_clients,
        'recent_expenses': _recent_expenses(start, end),
    }