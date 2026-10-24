from datetime import date, timedelta

DEFAULT_SEED_DAYS = 180


def build_date_range(today: date, days: int = 31) -> list[date]:
    return [today - timedelta(days=offset) for offset in range(days - 1, -1, -1)]
