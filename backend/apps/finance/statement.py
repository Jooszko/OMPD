import calendar
from datetime import date, timedelta

from .calculations import ZERO, daily_results, period_totals
from .models import Expense
from .overview import money

PERIOD_KINDS = ('month', 'quarter', 'year')
TREND_LENGTH = {'month': 6, 'quarter': 4, 'year': 3}
MONTH_NAMES = [
    'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
    'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień',
]
MONTH_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']
QUARTERS = ['I', 'II', 'III', 'IV']


def _month_end(year, month):
    return date(year, month, calendar.monthrange(year, month)[1])


def period_bounds(kind, anchor):
    """First and last day of the month, quarter or year that contains `anchor`."""
    if kind == 'month':
        return anchor.replace(day=1), _month_end(anchor.year, anchor.month)
    if kind == 'quarter':
        first_month = (anchor.month - 1) // 3 * 3 + 1
        return date(anchor.year, first_month, 1), _month_end(anchor.year, first_month + 2)
    return date(anchor.year, 1, 1), date(anchor.year, 12, 31)


def previous_bounds(kind, start):
    return period_bounds(kind, start - timedelta(days=1))


def period_label(kind, start, short=False):
    if kind == 'month':
        return MONTH_SHORT[start.month - 1] if short else f'{MONTH_NAMES[start.month - 1]} {start.year}'
    if kind == 'quarter':
        quarter = QUARTERS[(start.month - 1) // 3]
        return f'{quarter} kw.' if short else f'{quarter} kwartał {start.year}'
    return str(start.year)


def _totals(start, end, today):
    if start > today:
        return period_totals([])
    return period_totals(daily_results(start, min(end, today)))


def _lines(current, previous):
    def line(key, label, level, amount, before):
        return {'key': key, 'label': label, 'level': level, 'amount': money(amount), 'previous': money(before)}

    gross, gross_before = current['revenue'] - current['cogs'], previous['revenue'] - previous['cogs']
    lines = [
        line('sales', 'Sprzedaż', 'item', current['sales'], previous['sales']),
        line('returns', 'Zwroty od klientów', 'item', -current['returns'], -previous['returns']),
        line('revenue', 'Przychód netto', 'sum', current['revenue'], previous['revenue']),
        line('cogs', 'Koszt surowców', 'item', -current['cogs'], -previous['cogs']),
        line('gross_margin', 'Marża brutto', 'sum', gross, gross_before),
    ]
    for category, label in Expense.CATEGORY_CHOICES:
        amount = current['expenses_by_category'].get(category, ZERO)
        before = previous['expenses_by_category'].get(category, ZERO)
        if amount or before:
            lines.append(line(category, label, 'sub', -amount, -before))
    lines.append(line('operating', 'Koszty operacyjne razem', 'item', -current['operating_expenses'], -previous['operating_expenses']))
    lines.append(line('net_profit', 'Zysk netto', 'total', current['net_profit'], previous['net_profit']))
    return lines


def _pct(part, whole):
    return round(float(part / whole * 100), 1) if whole > 0 else None


def build_statement(kind, anchor, today=None):
    today = today or date.today()
    start, end = period_bounds(kind, anchor)
    previous_start, previous_end = previous_bounds(kind, start)
    current_days = daily_results(start, min(end, today))
    current = period_totals(current_days)
    previous = _totals(previous_start, previous_end, today)

    trend = []
    trend_start = start
    for _ in range(TREND_LENGTH[kind]):
        trend_end = period_bounds(kind, trend_start)[1]
        totals = current if trend_start == start else _totals(trend_start, trend_end, today)
        trend.append({
            'label': period_label(kind, trend_start, short=True),
            'start': str(trend_start),
            'revenue': money(totals['revenue']),
            'costs': money(totals['cogs'] + totals['operating_expenses']),
            'net_profit': money(totals['net_profit']),
        })
        trend_start = previous_bounds(kind, trend_start)[0]
    trend.reverse()

    return {
        'period': {
            'kind': kind,
            'start': str(start),
            'end': str(end),
            'label': period_label(kind, start),
            'previous_label': period_label(kind, previous_start),
            'is_complete': end < today,
        },
        'totals': {key: money(current[key]) for key in ('revenue', 'cogs', 'operating_expenses', 'net_profit')},
        'previous_totals': {key: money(previous[key]) for key in ('revenue', 'cogs', 'operating_expenses', 'net_profit')},
        'gross_margin': money(current['revenue'] - current['cogs']),
        'previous_gross_margin': money(previous['revenue'] - previous['cogs']),
        'gross_margin_pct': _pct(current['revenue'] - current['cogs'], current['revenue']),
        'net_margin_pct': _pct(current['net_profit'], current['revenue']),
        'lines': _lines(current, previous),
        'trend': trend,
        'days': (
            [{'date': str(day['date']), 'net_profit': money(day['net_profit'])} for day in current_days]
            if kind == 'month' else []
        ),
    }