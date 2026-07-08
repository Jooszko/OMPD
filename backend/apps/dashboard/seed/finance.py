from decimal import Decimal

from django.db.models import DecimalField, ExpressionWrapper, F, Sum

from finance.models import DailyFinancialReport, Expense
from orders.models import DailyOrder

EXPENSE_PLAN = [
    # (category, amount, description, day_offset_in_range)
    ('rent', Decimal('12000.00'), 'Czynsz za halę produkcyjną i biuro', 4),
    ('salary', Decimal('165000.00'), 'Wypłaty wynagrodzeń - załoga produkcyjna, piekarze, kierowcy', 9),
]

UTILITY_DESCRIPTIONS = [
    'Faktura za energię elektryczną - piece piekarnicze',
    'Faktura za gaz ziemny - piece i suszarnie',
    'Faktura za wodę i ścieki',
    'Opłata za wywóz odpadów produkcyjnych',
]

FUEL_DESCRIPTIONS = [
    'Paliwo - Trasa Skoczów', 'Paliwo - Trasa Ustroń', 'Paliwo - Trasa Bielsko',
    'Paliwo - Trasa Cieszyn', 'Paliwo - Trasa Wisła', 'Paliwo - Trasa Brenna',
]

OTHER_DESCRIPTIONS = [
    'Serwis pieca konwekcyjnego', 'Zakup rękawic i odzieży ochronnej',
    'Przegląd instalacji elektrycznej', 'Ubezpieczenie floty samochodowej',
    'Środki czystości - hala produkcyjna', 'Naprawa miksera przemysłowego',
    'Opłata za oprogramowanie księgowe', 'Wymiana filtrów w wentylacji',
    'Przegląd techniczny pojazdów dostawczych', 'Zakup pojemników transportowych',
]


def create_expenses(date_range, admin_user):
    created_count = 0

    for category, amount, description, day_offset in EXPENSE_PLAN:
        expense_date = date_range[day_offset]
        _, created = Expense.objects.get_or_create(
            category=category,
            date=expense_date,
            description=description,
            defaults={'amount': amount, 'created_by': admin_user},
        )
        if created:
            created_count += 1

    for i, description in enumerate(UTILITY_DESCRIPTIONS * 2):
        day_offset = (i * 4 + 2) % len(date_range)
        expense_date = date_range[day_offset]
        amount = Decimal(800 + (i * 137) % 1700)
        _, created = Expense.objects.get_or_create(
            category='utility',
            date=expense_date,
            description=f'{description} #{i + 1}',
            defaults={'amount': amount, 'created_by': admin_user},
        )
        if created:
            created_count += 1

    for i, description in enumerate(FUEL_DESCRIPTIONS * 2):
        day_offset = (i * 3 + 1) % len(date_range)
        expense_date = date_range[day_offset]
        amount = Decimal(150 + (i * 23) % 250)
        _, created = Expense.objects.get_or_create(
            category='fuel',
            date=expense_date,
            description=f'{description} #{i + 1}',
            defaults={'amount': amount, 'created_by': admin_user},
        )
        if created:
            created_count += 1

    for i, description in enumerate(OTHER_DESCRIPTIONS):
        day_offset = (i * 3) % len(date_range)
        expense_date = date_range[day_offset]
        amount = Decimal(200 + (i * 61) % 900)
        _, created = Expense.objects.get_or_create(
            category='other',
            date=expense_date,
            description=description,
            defaults={'amount': amount, 'created_by': admin_user},
        )
        if created:
            created_count += 1

    return created_count


def create_financial_reports(date_range):
    created_count = 0
    today = date_range[-1]

    for report_date in date_range:
        orders_qs = DailyOrder.objects.filter(order_date=report_date).exclude(status='cancelled')
        revenue = orders_qs.aggregate(
            total=Sum(
                ExpressionWrapper(
                    F('quantity') * F('price_at_sale'),
                    output_field=DecimalField(max_digits=12, decimal_places=2),
                )
            )
        )['total'] or Decimal('0.00')

        cogs_ratio = Decimal('0.26') + (Decimal(report_date.toordinal() % 7) * Decimal('0.01'))
        cogs = (revenue * cogs_ratio).quantize(Decimal('0.01'))

        expenses_total = Expense.objects.filter(date=report_date).aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0.00')

        net_profit = revenue - cogs - expenses_total
        is_finalized = report_date != today

        _, created = DailyFinancialReport.objects.get_or_create(
            report_date=report_date,
            defaults={
                'total_revenue': revenue,
                'total_cogs': cogs,
                'total_operating_expenses': expenses_total,
                'net_profit': net_profit,
                'is_finalized': is_finalized,
                'generated_by': None,
            },
        )
        if created:
            created_count += 1

    return created_count
