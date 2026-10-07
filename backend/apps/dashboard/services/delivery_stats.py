from collections import Counter, defaultdict
from datetime import timedelta

from orders.models import DailyOrder, DeliveryProof

HANDLED_STATUSES = {'delivered', 'failed'}
TOP_PROBLEM_CLIENTS = 5


def _stop_state(statuses):
    if not statuses <= HANDLED_STATUSES:
        return 'pending'
    return 'failed' if 'failed' in statuses else 'delivered'


def _effective_driver(order):
    if order.assigned_route_id is not None:
        return order.assigned_driver
    return order.client.route.driver


def _rate(part, whole):
    return round(part / whole * 100, 1) if whole else None


def _average(values):
    return round(sum(values) / len(values), 1) if values else None


def build_delivery_stats(start, end):
    orders = (
        DailyOrder.objects
        .filter(order_date__gte=start, order_date__lte=end)
        .exclude(status='cancelled')
        .select_related('client__route__driver', 'assigned_driver')
    )
    stops = defaultdict(list)
    for order in orders:
        stops[(order.order_date, order.client_id)].append(order)

    proof_kinds = defaultdict(set)
    proofs = DeliveryProof.objects.filter(order_date__gte=start, order_date__lte=end)
    for client_id, order_date, kind in proofs.values_list('client_id', 'order_date', 'kind'):
        proof_kinds[(order_date, client_id)].add(kind)

    daily = {start + timedelta(days=offset): Counter() for offset in range((end - start).days + 1)}
    reasons = Counter()
    problem_clients = Counter()
    client_names = {}
    drivers = {}
    driver_days = defaultdict(lambda: {'events': [], 'stops': 0})
    coverage = Counter()

    for (order_date, client_id), stop_orders in stops.items():
        state = _stop_state({o.status for o in stop_orders})
        daily[order_date][state] += 1
        if state == 'pending':
            continue

        driver = _effective_driver(stop_orders[0])
        driver_key = driver.user_id if driver else None
        entry = drivers.setdefault(driver_key, {
            'driver_id': driver_key,
            'full_name': driver.full_name if driver else 'Bez kierowcy',
            'delivered': 0,
            'failed': 0,
        })
        entry[state] += 1

        day = driver_days[(driver_key, order_date)]
        day['stops'] += 1
        day['events'].extend(t for o in stop_orders for t in (o.delivered_at, o.failed_at) if t is not None)

        if state == 'failed':
            client_names[client_id] = stop_orders[0].client.name
            problem_clients[client_id] += 1
            for reason in {o.failure_reason for o in stop_orders if o.status == 'failed' and o.failure_reason}:
                reasons[reason] += 1
        else:
            kinds = proof_kinds.get((order_date, client_id), set())
            coverage['delivered_stops'] += 1
            coverage['photo'] += 'photo' in kinds
            coverage['signature'] += 'signature' in kinds
            coverage['note'] += any(o.delivery_note for o in stop_orders)

    route_minutes = defaultdict(list)
    days_on_route = Counter()
    for (driver_key, _), day in driver_days.items():
        days_on_route[driver_key] += 1
        if day['stops'] < 2 or len(day['events']) < 2:
            continue
        minutes = (max(day['events']) - min(day['events'])).total_seconds() / 60
        route_minutes[driver_key].append(minutes)

    reason_labels = dict(DailyOrder.FAILURE_REASON_CHOICES)
    delivered = sum(day['delivered'] for day in daily.values())
    failed = sum(day['failed'] for day in daily.values())

    return {
        'period': {'start': str(start), 'end': str(end)},
        'summary': {
            'delivered': delivered,
            'failed': failed,
            'pending': sum(day['pending'] for day in daily.values()),
            'success_rate': _rate(delivered, delivered + failed),
        },
        'daily': [
            {'date': str(day), 'delivered': c['delivered'], 'failed': c['failed'], 'pending': c['pending']}
            for day, c in sorted(daily.items())
        ],
        'failure_reasons': [
            {'reason': reason, 'label': reason_labels.get(reason, reason), 'count': count}
            for reason, count in reasons.most_common()
        ],
        'problem_clients': [
            {'client_id': client_id, 'name': client_names[client_id], 'failed': count}
            for client_id, count in problem_clients.most_common(TOP_PROBLEM_CLIENTS)
        ],
        'drivers': sorted(
            (
                {
                    **entry,
                    'success_rate': _rate(entry['delivered'], entry['delivered'] + entry['failed']),
                    'days_on_route': days_on_route[key],
                    'avg_stops_per_day': round((entry['delivered'] + entry['failed']) / days_on_route[key], 1),
                    'avg_route_minutes': _average(route_minutes[key]),
                }
                for key, entry in drivers.items()
            ),
            key=lambda d: d['full_name'],
        ),
        'proof_coverage': {
            'delivered_stops': coverage['delivered_stops'],
            'photo': coverage['photo'],
            'signature': coverage['signature'],
            'note': coverage['note'],
        },
    }