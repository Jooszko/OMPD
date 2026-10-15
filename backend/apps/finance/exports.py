import csv
import io
from datetime import date
from decimal import Decimal

from django.db.models import Count, ExpressionWrapper, F, Q, Sum
from django.http import HttpResponse

from orders.models import DailyOrder, ProductReturn

from .calculations import MONEY, ZERO
from .closings import build_closings
from .models import Expense
from .statement import build_statement

SALE_VALUE = ExpressionWrapper(F('quantity') * F('price_at_sale'), output_field=MONEY)
RETURN_VALUE = ExpressionWrapper(F('quantity') * F('unit_price'), output_field=MONEY)


def amount(value):
    """Polish Excel expects a decimal comma: 1234,50."""
    return f'{Decimal(value):.2f}'.replace('.', ',')


def day(value):
    return f'{value:%d.%m.%Y}'


def period_slug(kind, start):
    if kind == 'month':
        return f'{start:%Y-%m}'
    if kind == 'quarter':
        return f'{start.year}-Q{(start.month - 1) // 3 + 1}'
    return str(start.year)


def csv_response(filename, header, rows):
    """CSV for Excel: UTF-8 with BOM (Polish letters) and semicolons (Polish list separator)."""
    buffer = io.StringIO()
    buffer.write('\ufeff')
    writer = csv.writer(buffer, delimiter=';')
    writer.writerow(header)
    writer.writerows(rows)
    response = HttpResponse(buffer.getvalue(), content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


def statement_csv(kind, anchor, start, end):
    statement = build_statement(kind, anchor)
    period = statement['period']
    rows = [[line['label'], amount(line['amount']), amount(line['previous'])] for line in statement['lines']]
    return ['Pozycja', period['label'], period['previous_label']], rows


def expenses_csv(kind, anchor, start, end):
    expenses = Expense.objects.filter(date__range=(start, end)).select_related('created_by').order_by('date', 'expense_id')
    rows = [
        [
            day(expense.date),
            expense.get_category_display(),
            expense.description,
            amount(expense.amount),
            expense.created_by.full_name if expense.created_by else '',
            'tak' if expense.recurring_id else 'nie',
        ]
        for expense in expenses
    ]
    return ['Data', 'Kategoria', 'Opis', 'Kwota (zł)', 'Dodał(a)', 'Cykliczny'], rows


def clients_csv(kind, anchor, start, end):
    sales = (
        DailyOrder.objects
        .filter(order_date__range=(start, end))
        .exclude(status__in=DailyOrder.NON_REVENUE_STATUSES)
        .values('client_id', 'client__name')
        .annotate(value=Sum(SALE_VALUE), deliveries=Count('order_date', distinct=True, filter=Q(status='delivered')))
    )
    returns = dict(
        ProductReturn.objects
        .filter(return_date__range=(start, end))
        .values('client_id')
        .annotate(value=Sum(RETURN_VALUE))
        .values_list('client_id', 'value')
    )
    clients = []
    for row in sales:
        returned = returns.get(row['client_id'], ZERO)
        clients.append((row['client__name'], row['deliveries'], row['value'], returned, row['value'] - returned))
    clients.sort(key=lambda client: client[4], reverse=True)
    rows = [[name, deliveries, amount(sold), amount(returned), amount(net)] for name, deliveries, sold, returned, net in clients]
    return ['Klient', 'Dostawy', 'Sprzedaż (zł)', 'Zwroty (zł)', 'Przychód netto (zł)'], rows


def closings_csv(kind, anchor, start, end):
    rows = []
    for item in reversed(build_closings(start, end)):
        closed = item['closed']
        rows.append([
            day(date.fromisoformat(item['date'])),
            amount(item['revenue']),
            amount(item['cogs']),
            amount(item['operating_expenses']),
            amount(item['net_profit']),
            'zamknięty' if closed else 'otwarty',
            (closed['closed_by'] or '') if closed else '',
            amount(closed['net_profit']) if closed else '',
            amount(item['drift']) if item['drift'] else '',
        ])
    header = [
        'Data', 'Przychód netto (zł)', 'Koszt surowców (zł)', 'Koszty operacyjne (zł)', 'Zysk netto (zł)',
        'Status', 'Zamknął(a)', 'Zysk przy zamknięciu (zł)', 'Rozbieżność (zł)',
    ]
    return header, rows


EXPORTS = {
    'statement': ('rachunek-zyskow-i-strat', statement_csv),
    'expenses': ('wydatki', expenses_csv),
    'clients': ('sprzedaz-wg-klientow', clients_csv),
    'closings': ('zamkniecia-dni', closings_csv),
}