import calendar
from datetime import date, timedelta

from django.db import transaction

from audit.services import record_event

from .expenses import expense_label, parse_expense
from .models import Expense, RecurringExpense

SYSTEM_ACTOR = 'System (wydatki cykliczne)'


def occurrence_in_month(year, month, day_of_month):
    return date(year, month, min(day_of_month, calendar.monthrange(year, month)[1]))


def next_occurrence(day_of_month, after):
    candidate = occurrence_in_month(after.year, after.month, day_of_month)
    if candidate > after:
        return candidate
    year, month = (after.year + 1, 1) if after.month == 12 else (after.year, after.month + 1)
    return occurrence_in_month(year, month, day_of_month)


def due_dates(template, today):
    last = template.last_generated_on or today - timedelta(days=1)
    dates = []
    current = next_occurrence(template.day_of_month, last)
    while current <= today:
        dates.append(current)
        current = next_occurrence(template.day_of_month, current)
    return dates


def materialize_due_expenses(today=None):
    today = today or date.today()
    created = 0
    with transaction.atomic():
        for template in RecurringExpense.objects.select_for_update().filter(is_active=True):
            dates = due_dates(template, today)
            for payment_date in dates:
                expense = Expense.objects.create(
                    category=template.category,
                    amount=template.amount,
                    description=template.description,
                    date=payment_date,
                    created_by=template.created_by,
                    recurring=template,
                )
                record_event(
                    None, category='finance', action='expense.created', obj=expense,
                    object_label=expense_label(expense), actor_name=SYSTEM_ACTOR,
                    description=(
                        f'Automatycznie dodano wydatek cykliczny „{expense.get_category_display()}”: '
                        f'{expense.amount:.2f} zł z dnia {payment_date:%d.%m.%Y}.'
                    ),
                )
                created += 1
            if dates:
                template.last_generated_on = dates[-1]
                template.save(update_fields=['last_generated_on', 'updated_at'])
    return created

RECURRING_AUDIT_LABELS = {
    'category': 'Kategoria',
    'amount': 'Kwota',
    'description': 'Opis',
    'day_of_month': 'Dzień płatności',
    'is_active': 'Status',
}


def day_label(day_of_month):
    return 'ostatniego dnia miesiąca' if day_of_month == 31 else f'{day_of_month}. dnia miesiąca'


def parse_day_of_month(value):
    try:
        day = int(value)
    except (TypeError, ValueError):
        return None, 'Nieprawidłowy dzień płatności.'
    if isinstance(value, bool) or not 1 <= day <= 31:
        return None, 'Dzień płatności musi być liczbą od 1 do 31.'
    return day, None


def parse_recurring_changes(data):
    fields, error = parse_expense({key: data[key] for key in ('category', 'amount', 'description') if key in data}, partial=True)
    if error:
        return None, error
    if 'day_of_month' in data:
        day, error = parse_day_of_month(data['day_of_month'])
        if error:
            return None, error
        fields['day_of_month'] = day
    if 'is_active' in data:
        if not isinstance(data['is_active'], bool):
            return None, 'Status musi mieć wartość prawda/fałsz.'
        fields['is_active'] = data['is_active']
    return fields, None


def covered_until(day_of_month, expense_date):
    return max(expense_date, occurrence_in_month(expense_date.year, expense_date.month, day_of_month))


def recurring_state(template):
    return {
        'category': template.get_category_display(),
        'amount': f'{template.amount:.2f} zł',
        'description': template.description,
        'day_of_month': day_label(template.day_of_month),
        'is_active': 'Aktywny' if template.is_active else 'Wstrzymany',
    }


def recurring_label(template):
    return template.description or template.get_category_display()


def serialize_recurring(template, today):
    next_date = previous_date = None
    if template.is_active:
        next_date = next_occurrence(template.day_of_month, max(template.last_generated_on or today, today))
        before = next_date.replace(day=1) - timedelta(days=1)
        previous_date = occurrence_in_month(before.year, before.month, template.day_of_month)
    return {
        'recurring_id': template.recurring_id,
        'category': template.category,
        'category_label': template.get_category_display(),
        'amount': str(template.amount),
        'description': template.description,
        'day_of_month': template.day_of_month,
        'is_active': template.is_active,
        'next_date': str(next_date) if next_date else None,
        'previous_date': str(previous_date) if previous_date else None,
        'days_until_next': (next_date - today).days if next_date else None,
    }