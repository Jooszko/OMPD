import csv
import io
import random
import tempfile
from datetime import date, timedelta
from decimal import Decimal
from itertools import permutations
from pathlib import Path

from django.core.management import call_command
from django.test import SimpleTestCase, TestCase

from clients.models import Client, Route
from dashboard.services.optimize import _nearest_neighbour, optimize_stop_order
from dashboard.services.route_evaluation import (
    benchmark, optimal_length_m, path_length_m, route_days, summarize,
)
from orders.models import DailyOrder
from products.models import Product


def brute_force_m(points):
    return min(path_length_m(points, [0, *rest]) for rest in permutations(range(1, len(points))))


class AlgorithmTests(SimpleTestCase):
    def setUp(self):
        self.rng = random.Random(7)

    def points(self, count):
        return [(49.8 + self.rng.random() * 0.1, 18.8 + self.rng.random() * 0.1) for _ in range(count)]

    def test_held_karp_matches_full_search(self):
        for count in (3, 5, 7):
            points = self.points(count)
            self.assertAlmostEqual(optimal_length_m(points), brute_force_m(points), places=6)

    def test_two_opt_is_between_nearest_neighbour_and_optimum(self):
        for _ in range(20):
            points = self.points(8)
            nearest = path_length_m(points, _nearest_neighbour(points))
            two_opt = path_length_m(points, optimize_stop_order(list(points)))
            self.assertLessEqual(two_opt, nearest + 1e-6)
            self.assertGreaterEqual(two_opt, optimal_length_m(points) - 1e-6)

    def test_summarize_uses_mean_length_for_saving_and_daily_average_for_gap(self):
        results = [
            {'alphabetical_km': 20, 'random_km': 20, 'nearest_neighbour_km': 12, 'two_opt_km': 11, 'optimal_km': 10},
            {'alphabetical_km': 10, 'random_km': 10, 'nearest_neighbour_km': 10, 'two_opt_km': 10, 'optimal_km': 10},
            {'alphabetical_km': 50, 'random_km': 50, 'nearest_neighbour_km': 50, 'two_opt_km': 50, 'optimal_km': None},
        ]
        rows = {row['method']: row for row in summarize(results)}

        self.assertAlmostEqual(rows['two_opt']['mean_km'], 10.5)
        self.assertAlmostEqual(rows['two_opt']['saving_pct'], 30.0)
        self.assertAlmostEqual(rows['two_opt']['gap_pct'], 5.0)
        self.assertAlmostEqual(rows['alphabetical']['gap_pct'], 50.0)

    def test_benchmark_returns_a_row_per_size(self):
        rows = benchmark([4, 6], seed=1, repeats=1)

        self.assertEqual([row['stops'] for row in rows], [4, 6])
        self.assertTrue(all(row['optimal_s'] >= 0 and row['two_opt_s'] >= 0 for row in rows))


class RouteDaysTests(TestCase):
    def setUp(self):
        self.day = date.today() - timedelta(days=1)
        self.route_a = Route.objects.create(route_name='Trasa A')
        self.route_b = Route.objects.create(route_name='Trasa B')
        self.product = Product.objects.create(name='Bułka', category='bread', base_price=Decimal('1.00'))
        self.clients = {
            name: Client.objects.create(
                name=name, address=name, route=self.route_a,
                latitude=Decimal(lat), longitude=Decimal('18.800000'),
            )
            for name, lat in (('Cukiernia', '49.810000'), ('Apteka', '49.800000'), ('Bar', '49.820000'))
        }
        self.no_coords = Client.objects.create(name='Daleki', address='Daleki', route=self.route_a)

    def order(self, client, status='delivered', **fields):
        DailyOrder.objects.create(
            client=client, product=self.product, order_date=self.day,
            quantity=1, price_at_sale=Decimal('1.00'), status=status, **fields,
        )

    def test_groups_stops_alphabetically_and_skips_cancelled_and_missing_coordinates(self):
        for client in self.clients.values():
            self.order(client)
        self.order(self.clients['Bar'])
        self.order(self.no_coords)
        cancelled = Client.objects.create(
            name='Anulowany', address='x', route=self.route_a, latitude=Decimal('49.9'), longitude=Decimal('18.9'),
        )
        self.order(cancelled, status='cancelled')

        days = route_days(self.day, self.day)

        self.assertEqual(len(days), 1)
        self.assertEqual(days[0].route_name, 'Trasa A')
        self.assertEqual(days[0].stop_names, ['Apteka', 'Bar', 'Cukiernia'])

    def test_uses_assigned_route_and_skips_routes_shorter_than_three_points(self):
        self.order(self.clients['Apteka'])
        self.order(self.clients['Bar'])
        self.order(self.clients['Cukiernia'], assigned_route=self.route_b)

        self.assertEqual(route_days(self.day, self.day), [])
        with_depot = route_days(self.day, self.day, depot=(49.7986, 18.7864))
        self.assertEqual([d.route_name for d in with_depot], ['Trasa A'])
        self.assertEqual(with_depot[0].stop_names, ['Piekarnia', 'Apteka', 'Bar'])


class EvaluateRoutesCommandTests(TestCase):
    def setUp(self):
        self.day = date.today() - timedelta(days=1)
        route = Route.objects.create(route_name='Trasa A')
        product = Product.objects.create(name='Bułka', category='bread', base_price=Decimal('1.00'))
        for index in range(4):
            client = Client.objects.create(
                name=f'Sklep {index}', address='x', route=route,
                latitude=Decimal('49.80') + Decimal(index) / 100, longitude=Decimal('18.80'),
            )
            DailyOrder.objects.create(
                client=client, product=product, order_date=self.day,
                quantity=1, price_at_sale=Decimal('1.00'), status='delivered',
            )

    def test_prints_summary_and_writes_csv(self):
        out = io.StringIO()
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'trasy.csv'
            call_command('evaluate_routes', start=self.day, end=self.day, output=str(path), stdout=out)
            with open(path, encoding='utf-8-sig') as handle:
                rows = list(csv.reader(handle, delimiter=';'))

        self.assertIn('Ocenione trasy: 1', out.getvalue())
        self.assertIn('Najbliższy sąsiad + 2-opt (aplikacja)', out.getvalue())
        self.assertEqual(rows[0][:3], ['data', 'trasa', 'przystanki'])
        self.assertEqual(rows[1][:3], [self.day.isoformat(), 'Trasa A', '4'])
        self.assertIn(',', rows[1][3])

    def test_benchmark_command_prints_a_row_per_size(self):
        out = io.StringIO()
        call_command('benchmark_routes', sizes=[4, 5], repeats=1, stdout=out)

        lines = out.getvalue().strip().splitlines()
        self.assertEqual(len(lines), 3)