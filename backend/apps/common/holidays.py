from datetime import date, timedelta
from functools import cache


def easter_sunday(year: int) -> date:
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    g = (8 * b + 13) // 25
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month, day = divmod(h + l - 7 * m + 114, 31)
    return date(year, month, day + 1)


@cache
def polish_holidays(year: int) -> frozenset[date]:
    easter = easter_sunday(year)
    fixed = [(1, 1), (1, 6), (5, 1), (5, 3), (8, 15), (11, 1), (11, 11), (12, 24), (12, 25), (12, 26)]
    movable = [easter, easter + timedelta(days=1), easter + timedelta(days=60)]
    return frozenset([date(year, month, day) for month, day in fixed] + movable)


def is_holiday(day: date) -> bool:
    return day in polish_holidays(day.year)