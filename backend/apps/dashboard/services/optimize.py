import math

MAX_TWO_OPT_STOPS = 60


def _haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = a
    lat2, lon2 = b
    radius_m = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    h = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * radius_m * math.asin(math.sqrt(h))


def _nearest_neighbour(coordinates: list[tuple[float, float]]) -> list[int]:
    n = len(coordinates)
    visited = [False] * n
    order = [0]
    visited[0] = True

    for _ in range(n - 1):
        last = order[-1]
        best_j, best_d = None, None
        for j in range(n):
            if visited[j]:
                continue
            d = _haversine_m(coordinates[last], coordinates[j])
            if best_d is None or d < best_d:
                best_j, best_d = j, d
        order.append(best_j)
        visited[best_j] = True

    return order


def _two_opt(order: list[int], coordinates: list[tuple[float, float]]) -> list[int]:
    n = len(order)
    improved = True
    while improved:
        improved = False
        for i in range(1, n - 2):
            for j in range(i + 1, n - 1):
                a, b = order[i - 1], order[i]
                c, d = order[j], order[j + 1]
                delta = (
                    _haversine_m(coordinates[a], coordinates[c]) + _haversine_m(coordinates[b], coordinates[d])
                    - _haversine_m(coordinates[a], coordinates[b]) - _haversine_m(coordinates[c], coordinates[d])
                )
                if delta < -1e-6:
                    order[i:j + 1] = reversed(order[i:j + 1])
                    improved = True
    return order


def optimize_stop_order(coordinates: list[tuple[float, float]]) -> list[int]:
    """Returns a permutation of indices into `coordinates`, starting at index 0."""
    n = len(coordinates)
    if n <= 2:
        return list(range(n))

    order = _nearest_neighbour(coordinates)
    if n <= MAX_TWO_OPT_STOPS:
        order = _two_opt(order, coordinates)
    return order
