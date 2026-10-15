from datetime import date
from decimal import Decimal, InvalidOperation

from .models import Expense

MAX_AMOUNT = Decimal('99999999.99')
MAX_DESCRIPTION_LENGTH = 255
EXPENSE_AUDIT_LABELS = {
    'category': 'Kategoria',
    'amount': 'Kwota',
    'date': 'Data',
    'description': 'Opis',
}


def parse_expense(data, partial=False):
    """Validated expense fields from request data, or (None, error). `partial` checks only the sent fields."""
    fields = {}

    if not partial or 'category' in data:
        category = data.get('category')
        if category not in dict(Expense.CATEGORY_CHOICES):
            return None, 'Nieprawidłowa kategoria kosztu.'
        fields['category'] = category

    if not partial or 'amount' in data:
        try:
            amount = Decimal(str(data.get('amount')).replace(',', '.'))
        except InvalidOperation:
            return None, 'Nieprawidłowa kwota.'
        if not amount.is_finite() or amount <= 0:
            return None, 'Kwota musi być większa od zera.'
        if amount > MAX_AMOUNT:
            return None, 'Kwota jest za duża.'
        fields['amount'] = amount.quantize(Decimal('0.01'))

    if not partial or 'date' in data:
        try:
            expense_date = date.fromisoformat(str(data.get('date')))
        except ValueError:
            return None, 'Nieprawidłowa data.'
        if expense_date > date.today():
            return None, 'Data wydatku nie może być w przyszłości.'
        fields['date'] = expense_date

    if not partial or 'description' in data:
        description = str(data.get('description') or '').strip()
        if len(description) > MAX_DESCRIPTION_LENGTH:
            return None, f'Opis może mieć najwyżej {MAX_DESCRIPTION_LENGTH} znaków.'
        fields['description'] = description

    return fields, None


def serialize_expense(expense):
    return {
        'expense_id': expense.expense_id,
        'category': expense.category,
        'category_label': expense.get_category_display(),
        'amount': str(expense.amount),
        'description': expense.description,
        'date': str(expense.date),
        'created_by': expense.created_by.full_name if expense.created_by else None,
        'recurring_id': expense.recurring_id,
    }


def expense_state(expense):
    """Human-readable values for the audit log."""
    return {
        'category': expense.get_category_display(),
        'amount': f'{expense.amount:.2f} zł',
        'date': f'{expense.date:%d.%m.%Y}',
        'description': expense.description,
    }


def expense_label(expense):
    return expense.description or expense.get_category_display()