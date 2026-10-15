from decimal import Decimal

from .calculations import daily_results
from .models import DailyFinancialReport
from .overview import money

AMOUNT_FIELDS = (
    ('revenue', 'total_revenue'),
    ('cogs', 'total_cogs'),
    ('operating_expenses', 'total_operating_expenses'),
    ('net_profit', 'net_profit'),
)


def live_day(day):
    """Today's view of a day: what the numbers are now, after every later change."""
    return daily_results(day, day)[0]


def close_day(day, user):
    """Freezes the day's numbers; returns the saved report."""
    result = live_day(day)
    return DailyFinancialReport.objects.create(
        report_date=day,
        total_revenue=result['revenue'],
        total_cogs=result['cogs'],
        total_operating_expenses=result['operating_expenses'],
        net_profit=result['net_profit'],
        is_finalized=True,
        generated_by=user,
    )


def _closed(report):
    return {
        **{key: money(getattr(report, field)) for key, field in AMOUNT_FIELDS},
        'closed_by': report.generated_by.full_name if report.generated_by else None,
        'closed_at': report.created_at.isoformat(),
    }


def build_closings(start, end):
    """Every day of the period, newest first, with live numbers and – for closed days – the frozen ones."""
    reports = {
        report.report_date: report
        for report in DailyFinancialReport.objects.filter(report_date__range=(start, end)).select_related('generated_by')
    }
    days = []
    for result in reversed(daily_results(start, end)):
        report = reports.get(result['date'])
        drift = result['net_profit'] - report.net_profit if report else Decimal('0')
        days.append({
            'date': str(result['date']),
            **{key: money(result[key]) for key, _ in AMOUNT_FIELDS},
            'closed': _closed(report) if report else None,
            'drift': money(drift) if report and drift else None,
        })
    return days