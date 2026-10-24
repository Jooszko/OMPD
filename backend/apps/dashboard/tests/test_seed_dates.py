from datetime import date

from django.test import SimpleTestCase

from dashboard.seed.dates import build_date_range, easter_sunday, is_holiday


class BuildDateRangeTests(SimpleTestCase):
    def test_returns_31_days_ascending_ending_today(self):
        today = date(2026, 7, 8)

        result = build_date_range(today)

        self.assertEqual(len(result), 31)
        self.assertEqual(result[-1], today)
        self.assertEqual(result[0], date(2026, 6, 8))
        self.assertEqual(result, sorted(result))

    def test_length_can_be_changed(self):
        today = date(2026, 7, 8)

        result = build_date_range(today, 180)

        self.assertEqual(len(result), 180)
        self.assertEqual(result[0], date(2026, 1, 10))
        self.assertEqual(result[-1], today)


class PolishHolidaysTests(SimpleTestCase):
    def test_easter_sunday(self):
        self.assertEqual(easter_sunday(2024), date(2024, 3, 31))
        self.assertEqual(easter_sunday(2025), date(2025, 4, 20))
        self.assertEqual(easter_sunday(2026), date(2026, 4, 5))
        self.assertEqual(easter_sunday(2027), date(2027, 3, 28))

    def test_fixed_and_movable_holidays(self):
        self.assertTrue(is_holiday(date(2026, 11, 11)))
        self.assertTrue(is_holiday(date(2026, 12, 24)))
        self.assertTrue(is_holiday(date(2026, 4, 6)))
        self.assertTrue(is_holiday(date(2026, 6, 4)))
        self.assertFalse(is_holiday(date(2026, 11, 12)))