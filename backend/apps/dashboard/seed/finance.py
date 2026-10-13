from decimal import Decimal

from django.db.models import DecimalField, ExpressionWrapper, F, Sum

from finance.models import DailyFinancialReport, Expense
from orders.models import DailyOrder

FALLBACK_MONTHLY_REVENUE = Decimal('20000')

MONTH_NAMES = [
    'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
    'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień',
]

MONTHLY_COSTS = [
    ('rent', 'Czynsz za halę produkcyjną i biuro', 1, Decimal('0.080')),
    ('salary', 'Wypłaty wynagrodzeń - piekarze i kierowcy', 10, Decimal('0.280')),
    ('utility', 'Faktura za energię elektryczną - piece piekarnicze', 15, Decimal('0.035')),
    ('utility', 'Faktura za gaz ziemny - piece', 18, Decimal('0.020')),
    ('utility', 'Faktura za wodę i ścieki', 20, Decimal('0.008')),
    ('utility', 'Opłata za wywóz odpadów produkcyjnych', 25, Decimal('0.005')),
]

ROUTES = ['Skoczów', 'Ustroń', 'Bielsko', 'Cieszyn', 'Wisła', 'Brenna']
FUEL_EVERY_DAYS = 3
FUEL_SHARE = Decimal('0.050')

OTHER_DESCRIPTIONS = [
    'Serwis pieca konwekcyjnego', 'Zakup rękawic i odzieży ochronnej',
    'Środki czystości - hala produkcyjna', 'Naprawa miksera przemysłowego',
    'Opłata za oprogramowanie księgowe', 'Wymiana filtrów w wentylacji',
    'Zakup pojemników transportowych',
]
OTHER_EVERY_DAYS = 6
OTHER_SHARE = Decimal('0.025')


def _monthly_revenue(date_range):
    total = (
        DailyOrder.objects
        .filter(order_date__range=(date_range[0], date_range[-1]))
        .exclude(status__in=DailyOrder.NON_REVENUE_STATUSES)
        .aggregate(total=Sum(ExpressionWrapper(
            F('quantity') * F('price_at_sale'), output_field=DecimalField(max_digits=12, decimal_places=2),
        )))['total']
    )
    if not total:
        return FALLBACK_MONTHLY_REVENUE
    return total / len(date_range) * 30


def _whole(amount, step=Decimal('1')):
    return max(step, (amount / step).quantize(Decimal('1')) * step)


def _add(category, expense_date, description, amount, admin_user):
    _, created = Expense.objects.get_or_create(
        category=category,
        date=expense_date,
        description=description,
        defaults={'amount': amount, 'created_by': admin_user},
    )
    return int(created)


def create_expenses(date_range, admin_user):
    monthly = _monthly_revenue(date_range)
    created_count = 0

    for day in date_range:
        month_label = f'{MONTH_NAMES[day.month - 1]} {day.year}'
        for category, description, day_of_month, share in MONTHLY_COSTS:
            if day.day == day_of_month:
                step = Decimal('10') if category in ('rent', 'salary') else Decimal('1')
                created_count += _add(
                    category, day, f'{description} - {month_label}', _whole(monthly * share, step), admin_user,
                )

        ordinal = day.toordinal()
        if ordinal % FUEL_EVERY_DAYS == 0:
            route = ROUTES[(ordinal // FUEL_EVERY_DAYS) % len(ROUTES)]
            variation = Decimal(85 + ordinal % 31) / 100
            amount = _whole(monthly * FUEL_SHARE * FUEL_EVERY_DAYS / 30 * variation)
            created_count += _add('fuel', day, f'Paliwo - Trasa {route}', amount, admin_user)

        if ordinal % OTHER_EVERY_DAYS == 2:
            description = OTHER_DESCRIPTIONS[(ordinal // OTHER_EVERY_DAYS) % len(OTHER_DESCRIPTIONS)]
            variation = Decimal(60 + ordinal % 81) / 100
            amount = _whole(monthly * OTHER_SHARE * OTHER_EVERY_DAYS / 30 * variation)
            created_count += _add('other', day, description, amount, admin_user)

    return created_count


def create_financial_reports(date_range):
    created_count = 0
    today = date_range[-1]

    for report_date in date_range:
        orders_qs = DailyOrder.objects.filter(order_date=report_date).exclude(status__in=DailyOrder.NON_REVENUE_STATUSES)
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
