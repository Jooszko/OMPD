from datetime import datetime, time, timedelta
from decimal import Decimal

from django.db.models import DecimalField, ExpressionWrapper, F, Sum
from finance.closings import live_day
from finance.models import DailyFinancialReport, Expense, RecurringExpense
from orders.models import DailyOrder

from dashboard.seed.orders import SEED_TIMEZONE

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

UNCLOSED_DAYS = 2
CLOSING_TIME = time(19, 30)

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

def _monthly_amount(monthly, category, share):
    step = Decimal('10') if category in ('rent', 'salary') else Decimal('1')
    return _whole(monthly * share, step)


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
                created_count += _add(
                    category, day, f'{description} - {month_label}', _monthly_amount(monthly, category, share),
                    admin_user,
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


def create_recurring_costs(date_range, admin_user):
    monthly = _monthly_revenue(date_range)
    created_count = 0
    for category, description, day_of_month, share in MONTHLY_COSTS:
        _, created = RecurringExpense.objects.get_or_create(
            category=category,
            description=description,
            day_of_month=day_of_month,
            defaults={
                'amount': _monthly_amount(monthly, category, share),
                'last_generated_on': date_range[-1],
                'created_by': admin_user,
            },
        )
        created_count += int(created)
    return created_count


def create_financial_reports(date_range, closed_by=None, open_days=0):
    """Closes the past days of the seed range with their real numbers; today and `open_days` before it stay open."""
    created_count = 0
    for report_date in date_range[:len(date_range) - 1 - open_days]:
        result = live_day(report_date)
        report, created = DailyFinancialReport.objects.get_or_create(
            report_date=report_date,
            defaults={
                'total_revenue': result['revenue'],
                'total_cogs': result['cogs'],
                'total_operating_expenses': result['operating_expenses'],
                'net_profit': result['net_profit'],
                'is_finalized': True,
                'generated_by': closed_by,
            },
        )
        if created:
            closed_at = datetime.combine(report_date + timedelta(days=1), CLOSING_TIME, tzinfo=SEED_TIMEZONE)
            DailyFinancialReport.objects.filter(pk=report.pk).update(created_at=closed_at, updated_at=closed_at)
            created_count += 1
    return created_count
