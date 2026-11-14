import random
import time
import tracemalloc
from dataclasses import dataclass

from django.db.models import F
from django.db.models.functions import Coalesce

from orders.models import DailyOrder

from .optimize import _haversine_m, _nearest_neighbour, optimize_stop_order

MAX_OPTIMAL_STOPS = 12
MIN_STOPS = 3
METHODS = ('alphabetical', 'random', 'nearest_neighbour', 'two_opt', 'optimal')
METHOD_LABELS = {
    'alphabetical': 'Kolejność alfabetyczna',
    'random': 'Kolejność losowa (średnia)',
    'nearest_neighbour': 'Najbliższy sąsiad',
    'two_opt': 'Najbliższy sąsiad + 2-opt (aplikacja)',
    'optimal': 'Optimum (Held-Karp)',
}
BENCHMARK_AREA = ((49.75, 49.85), (18.75, 18.85))


@dataclass
class RouteDay:
    order_date: object
    route_name: str
    stop_names: list
    points: list


def path_length_m(points, order):
    return sum(_haversine_m(points[a], points[b]) for a, b in zip(order, order[1:]))


def random_length_m(points, samples, rng):
    rest = list(range(1, len(points)))
    total = 0.0
    for _ in range(samples):
        rng.shuffle(rest)
        total += path_length_m(points, [0, *rest])
    return total / samples


def optimal_length_m(points):
    n = len(points)
    dist = [[_haversine_m(a, b) for b in points] for a in points]
    best = {(1 << j, j): dist[0][j] for j in range(1, n)}
    for size in range(2, n):
        layer = {}
        for (mask, last), length in best.items():
            if bin(mask).count('1') != size - 1:
                continue
            for nxt in range(1, n):
                if mask & (1 << nxt):
                    continue
                key = (mask | (1 << nxt), nxt)
                candidate = length + dist[last][nxt]
                if candidate < layer.get(key, float('inf')):
                    layer[key] = candidate
        best.update(layer)
    full = (1 << n) - 2
    return min(length for (mask, _), length in best.items() if mask == full)


def route_days(start, end, depot=None):
    rows = (
        DailyOrder.objects
        .filter(order_date__range=(start, end))
        .exclude(status='cancelled')
        .filter(client__latitude__isnull=False, client__longitude__isnull=False)
        .annotate(route_name=Coalesce(F('assigned_route__route_name'), F('client__route__route_name')))
        .values('order_date', 'route_name', 'client__name', 'client__latitude', 'client__longitude')
        .distinct()
    )
    grouped = {}
    for row in rows:
        stops = grouped.setdefault((row['order_date'], row['route_name'] or ''), {})
        stops[row['client__name']] = (float(row['client__latitude']), float(row['client__longitude']))

    days = []
    for (order_date, route_name), stops in sorted(grouped.items()):
        names = sorted(stops)
        points = [stops[name] for name in names]
        if depot is not None:
            names = ['Piekarnia', *names]
            points = [depot, *points]
        if len(points) >= MIN_STOPS:
            days.append(RouteDay(order_date, route_name, names, points))
    return days


def evaluate_day(day, samples, rng):
    points = day.points
    lengths = {
        'alphabetical': path_length_m(points, list(range(len(points)))),
        'random': random_length_m(points, samples, rng),
        'nearest_neighbour': path_length_m(points, _nearest_neighbour(points)),
        'two_opt': path_length_m(points, optimize_stop_order(list(points))),
        'optimal': optimal_length_m(points) if len(points) <= MAX_OPTIMAL_STOPS else None,
    }
    return {
        'date': day.order_date,
        'route': day.route_name,
        'stops': len(points),
        **{f'{method}_km': None if value is None else value / 1000 for method, value in lengths.items()},
    }


def summarize(results):
    rows = [r for r in results if r['optimal_km'] is not None]
    if not rows:
        return []
    count = len(rows)
    means = {method: sum(r[f'{method}_km'] for r in rows) / count for method in METHODS}
    summary = []
    for method in METHODS:
        gaps = [r[f'{method}_km'] / r['optimal_km'] - 1 for r in rows if r['optimal_km'] > 0]
        summary.append({
            'method': method,
            'label': METHOD_LABELS[method],
            'mean_km': means[method],
            'saving_pct': (1 - means[method] / means['alphabetical']) * 100 if means['alphabetical'] else 0.0,
            'gap_pct': sum(gaps) / len(gaps) * 100 if gaps else 0.0,
        })
    return summary


def benchmark_points(stops, rng):
    (lat_min, lat_max), (lng_min, lng_max) = BENCHMARK_AREA
    return [(rng.uniform(lat_min, lat_max), rng.uniform(lng_min, lng_max)) for _ in range(stops)]


def _seconds(function, points, repeats):
    best = float('inf')
    for _ in range(repeats):
        started = time.perf_counter()
        function(list(points))
        best = min(best, time.perf_counter() - started)
    return best


def _peak_memory_mb(function, points):
    tracemalloc.start()
    try:
        function(list(points))
        return tracemalloc.get_traced_memory()[1] / 1_000_000
    finally:
        tracemalloc.stop()


def benchmark(sizes, seed=1, repeats=3):
    rng = random.Random(seed)
    rows = []
    for stops in sizes:
        points = benchmark_points(stops, rng)
        rows.append({
            'stops': stops,
            'optimal_s': _seconds(optimal_length_m, points, repeats),
            'optimal_mb': _peak_memory_mb(optimal_length_m, points),
            'two_opt_s': _seconds(optimize_stop_order, points, repeats),
        })
    return rows