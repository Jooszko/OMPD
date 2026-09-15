from django.test import SimpleTestCase

from dashboard.services.optimize import optimize_stop_order


class OptimizeStopOrderTests(SimpleTestCase):
    def test_zero_or_one_point_returns_identity(self):
        self.assertEqual(optimize_stop_order([]), [])
        self.assertEqual(optimize_stop_order([(50.0, 18.0)]), [0])

    def test_two_points_returns_identity(self):
        coords = [(50.0, 18.0), (50.1, 18.1)]
        self.assertEqual(optimize_stop_order(coords), [0, 1])

    def test_first_stop_always_stays_first(self):
        coords = [(50.0, 18.0), (52.0, 20.0), (50.001, 18.001)]
        order = optimize_stop_order(coords)
        self.assertEqual(order[0], 0)
        self.assertEqual(set(order), {0, 1, 2})

    def test_improves_on_a_bad_input_order(self):
        coords = [(0.0, 0.0), (0.0, 0.04), (0.0, 0.02)]
        order = optimize_stop_order(coords)
        self.assertEqual(order, [0, 2, 1])

    def test_permutation_is_valid_for_larger_input(self):
        coords = [(50.0 + i * 0.01, 18.0 + (i % 3) * 0.02) for i in range(15)]
        order = optimize_stop_order(coords)
        self.assertEqual(sorted(order), list(range(15)))
        self.assertEqual(order[0], 0)
