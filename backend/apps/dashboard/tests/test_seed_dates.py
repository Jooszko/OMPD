from datetime import date

from django.test import SimpleTestCase

from dashboard.seed.dates import build_date_range


class BuildDateRangeTests(SimpleTestCase):
    def test_returns_31_days_ascending_ending_today(self):
        today = date(2026, 7, 8)

        result = build_date_range(today)

        self.assertEqual(len(result), 31)
        self.assertEqual(result[-1], today)
        self.assertEqual(result[0], date(2026, 6, 8))
        self.assertEqual(result, sorted(result))
