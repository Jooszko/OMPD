"""Planowanie produkcji: agregacja zamówień → masy ciasta → dzieże → listy odważeń."""
import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from orders.models import DailyOrder
from products.models import IngredientStock, Product

from ..models import (
    BatchIngredient,
    BatchOutput,
    Dough,
    Mixer,
    PlanLine,
    ProductBakeSpec,
    ProductionBatch,
    ProductionPlan,
    WasteRecord,
)

KG = Decimal('0.001')


class PlanningError(Exception):
    pass


class PlanLockedError(PlanningError):
    pass


def _kg(value):
    return Decimal(value).quantize(KG, rounding=ROUND_HALF_UP)


def shift_lag_days():
    return getattr(settings, 'PRODUCTION_SHIFT_LAG_DAYS', 1)


def production_date_for(delivery_date):
    """Produkcja z przesunięciem: zmiana wieczorna dnia D-lag piecze na dostawę dnia D."""
    return delivery_date - timedelta(days=shift_lag_days())


def delivery_date_for(production_date):
    return production_date + timedelta(days=shift_lag_days())


def current_production_date(now=None):
    """Dzień produkcyjny trwa od godziny granicznej (domyślnie 6:00) do tej samej godziny następnego dnia.
    Pierwsza i druga zmiana pracują więc na jeden plan, a tablica nie przeskakuje o północy."""
    zone = ZoneInfo(getattr(settings, 'PRODUCTION_TIMEZONE', 'Europe/Warsaw'))
    local = timezone.localtime(now or timezone.now(), zone)
    if local.hour < getattr(settings, 'PRODUCTION_SHIFT_CUTOFF_HOUR', 6):
        return local.date() - timedelta(days=1)
    return local.date()


def product_demand(delivery_date):
    """{product_id: łączna zamówiona ilość} dla zamówień z datą dostawy `delivery_date`."""
    rows = (
        DailyOrder.objects
        .filter(order_date=delivery_date)
        .exclude(status__in=DailyOrder.NON_REVENUE_STATUSES)
        .values('product_id')
        .annotate(total=Sum('quantity'))
    )
    return {row['product_id']: row['total'] for row in rows if row['total'] > 0}


@dataclass(frozen=True)
class PieceDemand:
    key: int
    quantity: int
    piece_weight_kg: Decimal


@dataclass
class BatchSplit:
    pieces: dict
    dough_mass_kg: Decimal


def split_into_batches(demands, loss_factor, max_capacity_kg):
    """Dzieli zapotrzebowanie na kęsy na możliwie równe dzieże.

    Liczba dzieży to minimum, przy którym żadna nie przekracza pojemności mieszałki.
    Kęsy każdego wyrobu rozkładane są po równo, a reszta trafia do najlżejszych dzieży,
    dzięki czemu masy dzieży różnią się co najwyżej o pojedyncze kęsy (zamiast układu
    „pełna + resztka”).
    """
    demands = [d for d in demands if d.quantity > 0]
    if not demands:
        return []

    max_capacity_kg = Decimal(max_capacity_kg)
    raw_total = sum(d.quantity * d.piece_weight_kg for d in demands)
    total_pieces = sum(d.quantity for d in demands)
    count = max(1, math.ceil(raw_total * loss_factor / max_capacity_kg))

    while True:
        pieces = [defaultdict(int) for _ in range(count)]
        raw_masses = [Decimal('0')] * count
        for demand in sorted(demands, key=lambda d: (-d.piece_weight_kg, d.key)):
            base, remainder = divmod(demand.quantity, count)
            for i in range(count):
                if base:
                    pieces[i][demand.key] += base
                    raw_masses[i] += base * demand.piece_weight_kg
            for i in sorted(range(count), key=lambda i: (raw_masses[i], i))[:remainder]:
                pieces[i][demand.key] += 1
                raw_masses[i] += demand.piece_weight_kg

        heaviest = max(raw_masses) * loss_factor
        if heaviest <= max_capacity_kg or count >= total_pieces:
            break
        count += 1

    return [
        BatchSplit(pieces=dict(p), dough_mass_kg=_kg(mass * loss_factor))
        for p, mass in zip(pieces, raw_masses)
        if p
    ]


def _batches_label(count):
    if count == 1:
        return '1 dzieża'
    if count % 10 in (2, 3, 4) and count % 100 not in (12, 13, 14):
        return f'{count} dzieże'
    return f'{count} dzieży'


def _split_score(splits, mixer):
    """Im mniejszy, tym lepiej: najpierw dzieże ponad pojemność, potem poniżej minimum, potem ich liczba."""
    over = sum(1 for s in splits if s.dough_mass_kg > mixer.max_capacity_kg)
    under = sum(1 for s in splits if s.dough_mass_kg < mixer.min_capacity_kg)
    return over, under, len(splits)


def _choose_mixer(dough, active_mixers, demands, loss_factor):
    """Dobiera mieszałkę i podział na dzieże.

    Mieszałka przypisana do ciasta ma pierwszeństwo, ale ustępuje innej, jeśli tamta pozwala
    uniknąć wsadu poniżej minimum albo zrobić ciasto w mniejszej liczbie dzieży.
    Zwraca (mieszałka, podział, notatka o zmianie mieszałki lub None).
    """
    preferred = dough.mixer if dough.mixer_id and dough.mixer.is_active else None
    candidates = active_mixers if preferred is None else (
        [preferred] + [m for m in active_mixers if m.mixer_id != preferred.mixer_id]
    )

    scored = []
    for mixer in candidates:
        splits = split_into_batches(demands, loss_factor, mixer.max_capacity_kg)
        scored.append((_split_score(splits, mixer), mixer, splits))
    if not scored:
        return None, [], None

    # min() bierze pierwszy z równych wyników, więc przy remisie wygrywa mieszałka przypisana.
    best_score, mixer, splits = min(scored, key=lambda entry: entry[0])
    note = None
    if preferred is not None and mixer.mixer_id != preferred.mixer_id:
        preferred_score = scored[0][0]
        if best_score[1] < preferred_score[1]:
            reason = 'bez wsadu poniżej minimum'
        else:
            reason = f'{_batches_label(best_score[2])} zamiast {preferred_score[2]}'
        note = f'Użyto mieszałki {mixer.name} zamiast przypisanej {preferred.name} ({reason}).'
    return mixer, splits, note


def _mixer_payload(mixer):
    if mixer is None:
        return None
    return {
        'mixer_id': mixer.mixer_id,
        'name': mixer.name,
        'min_capacity_kg': mixer.min_capacity_kg,
        'max_capacity_kg': mixer.max_capacity_kg,
    }


def _batch_warnings(sequence, mass_kg, mixer):
    warnings = []
    if mixer is None:
        return warnings
    if mass_kg > mixer.max_capacity_kg:
        warnings.append(
            f'Dzieża #{sequence} ({mass_kg} kg) przekracza pojemność mieszałki '
            f'{mixer.name} — pojedynczy kęs jest zbyt ciężki.'
        )
    if mass_kg < mixer.min_capacity_kg:
        warnings.append(
            f'Dzieża #{sequence} ({mass_kg} kg) jest poniżej minimalnego wsadu '
            f'mieszałki {mixer.name} ({mixer.min_capacity_kg} kg).'
        )
    return warnings


def _add_to_totals(totals, ingredients):
    for item in ingredients:
        total = totals.setdefault(item['ingredient_id'], {**item, 'amount': Decimal('0')})
        total['amount'] += item['amount']


def _ingredient_balance(ingredient_totals):
    """Zapotrzebowanie na surowce zestawione ze stanem magazynu."""
    stock = _ingredient_stock(ingredient_totals.keys())
    balance = []
    for ingredient_id, item in sorted(ingredient_totals.items(), key=lambda kv: kv[1]['name']):
        current = stock.get(ingredient_id, Decimal('0'))
        balance.append({
            **item,
            'amount': _kg(item['amount']),
            'current_stock': current,
            'shortage': _kg(max(Decimal('0'), item['amount'] - current)),
        })
    return balance


def _scaled_ingredients(dough, mass_kg):
    return [
        {
            'ingredient_id': di.ingredient_id,
            'name': di.ingredient.name,
            'unit': di.ingredient.unit,
            'amount': _kg(di.amount_per_kg * mass_kg),
        }
        for di in dough.dough_ingredients.all()
    ]


def build_plan_preview(delivery_date):
    """Wylicza plan bez zapisywania: ciasta, dzieże, listy odważeń i bilans surowców."""
    demand = product_demand(delivery_date)
    specs = {
        spec.product_id: spec
        for spec in ProductBakeSpec.objects.filter(product_id__in=demand.keys()).select_related('product')
    }
    products = {p.product_id: p for p in Product.objects.filter(product_id__in=demand.keys())}
    active_mixers = list(Mixer.objects.filter(is_active=True).order_by('-max_capacity_kg', 'mixer_id'))

    dough_ids = {spec.dough_id for spec in specs.values()}
    doughs = (
        Dough.objects
        .filter(dough_id__in=dough_ids)
        .select_related('mixer')
        .prefetch_related('dough_ingredients__ingredient')
        .order_by('name')
    )

    ingredient_totals = {}
    dough_plans = []
    for dough in doughs:
        loss_factor = 1 + dough.loss_buffer_pct / Decimal('100')
        dough_specs = sorted(
            (s for s in specs.values() if s.dough_id == dough.dough_id), key=lambda s: s.product.name
        )
        product_rows = [
            {
                'product_id': s.product_id,
                'product_name': s.product.name,
                'ordered_qty': demand[s.product_id],
                'piece_weight_kg': s.piece_weight_kg,
                'raw_mass_kg': _kg(demand[s.product_id] * s.piece_weight_kg),
                'bake_temp_c': s.bake_temp_c,
                'bake_time_min': s.bake_time_min,
            }
            for s in dough_specs
        ]
        raw_mass = sum((row['raw_mass_kg'] for row in product_rows), Decimal('0'))
        mixer, splits, mixer_note = _choose_mixer(
            dough,
            active_mixers,
            [PieceDemand(s.product_id, demand[s.product_id], s.piece_weight_kg) for s in dough_specs],
            loss_factor,
        )
        warnings = []
        notes = [mixer_note] if mixer_note else []
        batches = []

        if mixer is None:
            warnings.append('Brak aktywnej mieszałki — nie można podzielić ciasta na dzieże.')
        else:
            for sequence, split in enumerate(splits, start=1):
                warnings.extend(_batch_warnings(sequence, split.dough_mass_kg, mixer))
                ingredients = _scaled_ingredients(dough, split.dough_mass_kg)
                _add_to_totals(ingredient_totals, ingredients)
                batches.append({
                    'sequence': sequence,
                    'dough_mass_kg': split.dough_mass_kg,
                    'outputs': [
                        {
                            'product_id': row['product_id'],
                            'product_name': row['product_name'],
                            'pieces': split.pieces[row['product_id']],
                        }
                        for row in product_rows
                        if split.pieces.get(row['product_id'])
                    ],
                    'ingredients': ingredients,
                })

        if not dough.dough_ingredients.all():
            warnings.append('Ciasto nie ma zdefiniowanej receptury — lista odważeń będzie pusta.')

        dough_plans.append({
            'dough_id': dough.dough_id,
            'name': dough.name,
            'loss_buffer_pct': dough.loss_buffer_pct,
            'raw_mass_kg': _kg(raw_mass),
            'total_mass_kg': _kg(raw_mass * loss_factor),
            'mixer': _mixer_payload(mixer),
            'products': product_rows,
            'batches': batches,
            'warnings': warnings,
            'notes': notes,
        })

    unassigned = sorted(
        (
            {'product_id': pid, 'product_name': products[pid].name, 'ordered_qty': qty}
            for pid, qty in demand.items()
            if pid not in specs
        ),
        key=lambda row: row['product_name'],
    )

    return {
        'delivery_date': delivery_date,
        'production_date': production_date_for(delivery_date),
        'doughs': dough_plans,
        'unassigned_products': unassigned,
        'ingredient_totals': _ingredient_balance(ingredient_totals),
    }


def build_saved_plan(plan):
    """Ciasta i dzieże z zapisanego planu, w kształcie podglądu — to, co faktycznie idzie na produkcję."""
    ordered = dict(plan.lines.values_list('product_id', 'ordered_qty'))
    batches = (
        plan.batches
        .select_related('dough', 'mixer')
        .prefetch_related('ingredients__ingredient', 'outputs__product')
        .order_by('dough__name', 'sequence')
    )

    by_dough = {}
    ingredient_totals = {}
    for batch in batches:
        entry = by_dough.setdefault(batch.dough_id, {
            'dough': batch.dough, 'mixer': batch.mixer, 'products': {}, 'batches': [], 'warnings': [],
        })
        outputs = sorted(batch.outputs.all(), key=lambda o: o.product.name)
        for output in outputs:
            qty = ordered.get(output.product_id, 0)
            entry['products'].setdefault(output.product_id, {
                'product_id': output.product_id,
                'product_name': output.product.name,
                'ordered_qty': qty,
                'piece_weight_kg': output.piece_weight_kg,
                'raw_mass_kg': _kg(qty * output.piece_weight_kg),
                'bake_temp_c': output.bake_temp_c,
                'bake_time_min': output.bake_time_min,
            })
        ingredients = [
            {
                'ingredient_id': item.ingredient_id,
                'name': item.ingredient.name,
                'unit': item.ingredient.unit,
                'amount': item.amount,
            }
            for item in batch.ingredients.all()
        ]
        _add_to_totals(ingredient_totals, ingredients)
        entry['warnings'].extend(_batch_warnings(batch.sequence, batch.dough_mass_kg, batch.mixer))
        entry['batches'].append({
            'sequence': batch.sequence,
            'dough_mass_kg': batch.dough_mass_kg,
            'outputs': [
                {'product_id': o.product_id, 'product_name': o.product.name, 'pieces': o.planned_pieces}
                for o in outputs
            ],
            'ingredients': ingredients,
        })

    doughs = []
    for entry in sorted(by_dough.values(), key=lambda e: e['dough'].name):
        products = sorted(entry['products'].values(), key=lambda row: row['product_name'])
        doughs.append({
            'dough_id': entry['dough'].dough_id,
            'name': entry['dough'].name,
            'loss_buffer_pct': entry['dough'].loss_buffer_pct,
            'raw_mass_kg': _kg(sum((row['raw_mass_kg'] for row in products), Decimal('0'))),
            'total_mass_kg': _kg(sum((b['dough_mass_kg'] for b in entry['batches']), Decimal('0'))),
            'mixer': _mixer_payload(entry['mixer']),
            'products': products,
            'batches': entry['batches'],
            'warnings': entry['warnings'],
            'notes': [],
        })
    return doughs, _ingredient_balance(ingredient_totals)


def order_changes(plan, preview):
    """Różnice między ilościami z zatwierdzonego planu a bieżącymi zamówieniami (tylko wyroby z ciastem)."""
    planned = {
        line.product_id: (line.product.name, line.ordered_qty)
        for line in plan.lines.select_related('product')
    }
    current = {
        row['product_id']: (row['product_name'], row['ordered_qty'])
        for dough in preview['doughs']
        for row in dough['products']
    }
    changes = []
    for product_id in planned.keys() | current.keys():
        name, planned_qty = planned.get(product_id, (None, 0))
        current_name, current_qty = current.get(product_id, (None, 0))
        if planned_qty != current_qty:
            changes.append({
                'product_id': product_id,
                'product_name': name or current_name,
                'planned_qty': planned_qty,
                'current_qty': current_qty,
                'difference': current_qty - planned_qty,
            })
    return sorted(changes, key=lambda row: row['product_name'])


def plan_overview(delivery_date, plan):
    """Widok planowania: podgląd na żywo, a po zatwierdzeniu — zapisane dzieże i zmiany w zamówieniach."""
    preview = build_plan_preview(delivery_date)
    if plan is None:
        return preview, []
    doughs, ingredient_totals = build_saved_plan(plan)
    changes = order_changes(plan, preview)
    return {**preview, 'doughs': doughs, 'ingredient_totals': ingredient_totals}, changes


def _ingredient_stock(ingredient_ids):
    return dict(
        IngredientStock.objects
        .filter(ingredient_id__in=list(ingredient_ids))
        .values_list('ingredient_id', 'current_stock')
    )


def plan_is_locked(plan):
    """Plan jest zablokowany, gdy którakolwiek dzieża ruszyła albo zgłoszono w niej stratę —
    przeliczenie usunęłoby dzieże razem z tą historią."""
    started = plan.batches.exclude(stage=ProductionBatch.STAGE_MIXING, stage_started_at__isnull=True).exists()
    return started or WasteRecord.objects.filter(batch__plan=plan).exists()


@transaction.atomic
def generate_plan(delivery_date, user):
    """Zapisuje plan i dzieże. Ponowne generowanie jest możliwe, dopóki żadna dzieża nie ruszyła."""
    existing = ProductionPlan.objects.select_for_update().filter(delivery_date=delivery_date).first()
    if existing is not None:
        if plan_is_locked(existing):
            raise PlanLockedError(
                'Produkcja dla tej daty już się rozpoczęła lub zgłoszono straty — planu nie można przeliczyć.'
            )
        existing.delete()

    preview = build_plan_preview(delivery_date)
    if not preview['doughs']:
        raise PlanningError('Brak zamówień z przypisanym ciastem na wybraną datę dostawy.')

    plan = ProductionPlan.objects.create(
        delivery_date=delivery_date,
        production_date=preview['production_date'],
        created_by=user,
    )
    PlanLine.objects.bulk_create([
        PlanLine(plan=plan, product_id=row['product_id'], ordered_qty=row['ordered_qty'])
        for dough in preview['doughs']
        for row in dough['products']
    ])

    for dough in preview['doughs']:
        product_rows = {row['product_id']: row for row in dough['products']}
        mixer_id = dough['mixer']['mixer_id'] if dough['mixer'] else None
        for batch_data in dough['batches']:
            batch = ProductionBatch.objects.create(
                plan=plan,
                dough_id=dough['dough_id'],
                mixer_id=mixer_id,
                sequence=batch_data['sequence'],
                batch_count=len(dough['batches']),
                dough_mass_kg=batch_data['dough_mass_kg'],
            )
            BatchIngredient.objects.bulk_create([
                BatchIngredient(batch=batch, ingredient_id=item['ingredient_id'], amount=item['amount'])
                for item in batch_data['ingredients']
            ])
            BatchOutput.objects.bulk_create([
                BatchOutput(
                    batch=batch,
                    product_id=output['product_id'],
                    planned_pieces=output['pieces'],
                    piece_weight_kg=product_rows[output['product_id']]['piece_weight_kg'],
                    bake_temp_c=product_rows[output['product_id']]['bake_temp_c'],
                    bake_time_min=product_rows[output['product_id']]['bake_time_min'],
                )
                for output in batch_data['outputs']
            ])

    (
        DailyOrder.objects
        .filter(order_date=delivery_date, status='planned', product_id__in=_planned_product_ids(preview))
        .update(status='in_production')
    )
    return plan, preview


def _planned_product_ids(preview):
    return [row['product_id'] for dough in preview['doughs'] for row in dough['products']]
