from datetime import date, timedelta


def build_date_range(today: date) -> list[date]:
    return [today - timedelta(days=offset) for offset in range(30, -1, -1)]
