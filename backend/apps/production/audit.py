"""Wpisy dziennika zdarzeń dla modułu produkcji (kategoria „Produkcja”)."""
from audit.services import field_changes, record_event

from .models import BatchStageLog, ProductionBatch
from .services.lifecycle import good_pieces_by_product

CATEGORY = 'production'

MIXER_LABELS = {
    'name': 'Nazwa',
    'min_capacity_kg': 'Minimalny wsad [kg]',
    'max_capacity_kg': 'Maksymalny wsad [kg]',
    'is_active': 'Sprawna',
}
DOUGH_LABELS = {
    'name': 'Nazwa',
    'mixer': 'Domyślna mieszałka',
    'loss_buffer_pct': 'Bufor strat [%]',
    'mixing_time_min': 'Mieszanie [min]',
    'target_dough_temp_c': 'Temperatura ciasta [°C]',
    'proofing_time_min': 'Garowanie [min]',
    'mixing_instructions': 'Instrukcja mieszania',
}
BAKE_SPEC_LABELS = {
    'dough': 'Ciasto',
    'piece_weight_kg': 'Waga kęsa [kg]',
    'bake_temp_c': 'Temperatura wypieku [°C]',
    'bake_time_min': 'Czas wypieku [min]',
}
RECIPE_PREFIX = 'recipe:'


def _plural(count, one, few, many):
    if count == 1:
        return f'1 {one}'
    if count % 10 in (2, 3, 4) and count % 100 not in (12, 13, 14):
        return f'{count} {few}'
    return f'{count} {many}'


def _number(value):
    """Liczba dziesiętna bez zbędnych zer: Decimal('20.000') → '20'."""
    return format(value.normalize(), 'f') if value is not None else None


# ---------------------------------------------------------------------------
# Stan obiektów (do porównania przed/po)
# ---------------------------------------------------------------------------


def mixer_state(mixer):
    if mixer is None:
        return {}
    return {
        'name': mixer.name,
        'min_capacity_kg': _number(mixer.min_capacity_kg),
        'max_capacity_kg': _number(mixer.max_capacity_kg),
        'is_active': mixer.is_active,
    }


def dough_state(dough):
    if dough is None:
        return {}
    state = {
        'name': dough.name,
        'mixer': dough.mixer.name if dough.mixer_id else 'dobierana automatycznie',
        'loss_buffer_pct': _number(dough.loss_buffer_pct),
        'mixing_time_min': dough.mixing_time_min,
        'target_dough_temp_c': _number(dough.target_dough_temp_c),
        'proofing_time_min': dough.proofing_time_min,
        'mixing_instructions': dough.mixing_instructions,
    }
    for item in dough.dough_ingredients.select_related('ingredient'):
        state[f'{RECIPE_PREFIX}{item.ingredient.name}'] = f'{_number(item.amount_per_kg)} {item.ingredient.unit}/kg'
    return state


def dough_changes(before, after):
    recipe_keys = sorted(k for k in before.keys() | after.keys() if k.startswith(RECIPE_PREFIX))
    labels = {**DOUGH_LABELS, **{k: f'Receptura: {k[len(RECIPE_PREFIX):]}' for k in recipe_keys}}
    return field_changes(before, after, labels)


def bake_spec_state(spec):
    if spec is None:
        return {}
    return {
        'dough': spec.dough.name,
        'piece_weight_kg': _number(spec.piece_weight_kg),
        'bake_temp_c': spec.bake_temp_c,
        'bake_time_min': spec.bake_time_min,
    }


def plan_state(plan):
    """{nazwa wyrobu: ilość w planie} oraz liczba dzieży — do porównania przy przeliczeniu."""
    if plan is None:
        return {}
    state = {line.product.name: line.ordered_qty for line in plan.lines.select_related('product')}
    state['__batches__'] = plan.batches.count()
    return state


def _plan_changes(before, after):
    products = sorted(k for k in before.keys() | after.keys() if k != '__batches__')
    labels = {'__batches__': 'Liczba dzieży', **{name: f'{name} [szt.]' for name in products}}
    return field_changes(before, after, labels)


# ---------------------------------------------------------------------------
# Zdarzenia
# ---------------------------------------------------------------------------


def _batch_label(batch):
    return f'{batch.dough.name} #{batch.sequence}/{batch.batch_count}, dostawa {batch.plan.delivery_date:%d.%m.%Y}'


def _plan_label(plan):
    return f'Plan na dostawę {plan.delivery_date:%d.%m.%Y}'


def plan_generated(request, plan, preview, before):
    """Zatwierdzenie planu albo jego przeliczenie (gdy `before` opisuje poprzednią wersję)."""
    doughs = preview['doughs']
    batches = sum(len(d['batches']) for d in doughs)
    mass = sum(d['total_mass_kg'] for d in doughs)
    summary = (
        f"{_plural(len(doughs), 'ciasto', 'ciasta', 'ciast')}, "
        f"{_plural(batches, 'dzieża', 'dzieże', 'dzieży')}, {_number(mass)} kg ciasta"
    )
    regenerated = bool(before)
    record_event(
        request, category=CATEGORY, action='plan.regenerated' if regenerated else 'plan.generated',
        obj=plan, object_label=_plan_label(plan),
        description=(
            f'{"Przeliczono" if regenerated else "Zatwierdzono"} plan produkcji na dostawę '
            f'{plan.delivery_date:%d.%m.%Y} ({summary}).'
        ),
        changes=_plan_changes(before, plan_state(plan)),
    )


def stage_completed(request, batch, finished_stage):
    """Zakończenie etapu dzieży; przy mieszaniu i wypieku także skutki magazynowe."""
    stage_labels = dict(ProductionBatch.STAGE_CHOICES)
    log = (
        BatchStageLog.objects.filter(batch=batch, stage=finished_stage)
        .select_related('started_by').order_by('-started_at').first()
    )
    description = f'Zakończono etap „{stage_labels[finished_stage]}” dzieży {batch.dough.name} #{batch.sequence}.'
    if log and log.started_by_id and log.started_by_id != request.user.pk:
        description += f' Etap rozpoczął(a): {log.started_by.full_name or log.started_by.username}.'
    if finished_stage == ProductionBatch.STAGE_MIXING:
        items = ', '.join(
            f'{i.ingredient.name} {_number(i.amount)} {i.ingredient.unit}'
            for i in batch.ingredients.select_related('ingredient')
        )
        if items:
            description += f' Pobrano z magazynu: {items}.'
    if batch.stage == ProductionBatch.STAGE_DONE:
        names = {o.product_id: o.product.name for o in batch.outputs.select_related('product')}
        received = ', '.join(f'{names[pid]} {qty} szt.' for pid, qty in good_pieces_by_product(batch).items() if qty)
        if received:
            description += f' Przyjęto na magazyn: {received}.'
    record_event(
        request, category=CATEGORY, action='batch.stage_completed', obj=batch, object_label=_batch_label(batch),
        description=description,
        changes=field_changes(
            {'stage': stage_labels[finished_stage]}, {'stage': stage_labels[batch.stage]}, {'stage': 'Etap'}
        ),
    )


def waste_recorded(request, batch, record, coverage_row):
    description = (
        f'Zgłoszono stratę {record.quantity} szt. {record.product.name} '
        f'({record.get_reason_display().lower()}) na etapie „{record.get_stage_display()}” '
        f'dzieży {batch.dough.name} #{batch.sequence}.'
    )
    if coverage_row and coverage_row['shortfall'] > 0:
        description += f' Zamówienia niepokryte — brakuje {coverage_row["shortfall"]} szt.'
    record_event(
        request, category=CATEGORY, action='batch.waste_recorded', obj=batch, object_label=_batch_label(batch),
        description=description,
    )


def mixer_saved(request, mixer, before):
    after = mixer_state(mixer)
    changes = field_changes(before, after, MIXER_LABELS)
    if before and not changes:
        return
    created = not before
    record_event(
        request, category=CATEGORY, action='mixer.created' if created else 'mixer.updated', obj=mixer,
        object_label=mixer.name, changes=changes,
        description=f'{"Dodano" if created else "Zmieniono"} mieszałkę {mixer.name}.',
    )


def dough_saved(request, dough, before):
    after = dough_state(dough)
    changes = dough_changes(before, after)
    if before and not changes:
        return
    created = not before
    record_event(
        request, category=CATEGORY, action='dough.created' if created else 'dough.updated', obj=dough,
        object_label=dough.name, changes=changes,
        description=f'{"Dodano" if created else "Zmieniono"} ciasto {dough.name}.',
    )


def dough_deleted(request, dough, before):
    record_event(
        request, category=CATEGORY, action='dough.deleted', obj=dough, object_label=before['name'],
        description=f'Usunięto ciasto {before["name"]} wraz z recepturą.', changes=dough_changes(before, {}),
    )


def bake_spec_saved(request, product, before, spec):
    """Parametry wyrobu zapisujemy przy produkcie, żeby historia produktu pokazywała je razem z ceną i recepturą."""
    changes = field_changes(before, bake_spec_state(spec), BAKE_SPEC_LABELS)
    if before and not changes:
        return
    record_event(
        request, category=CATEGORY, action='bake_spec.updated', obj=product, object_label=product.name,
        changes=changes,
        description=(
            f'Zmieniono parametry produkcyjne wyrobu {product.name}.' if before
            else f'Przypisano wyrób {product.name} do ciasta {spec.dough.name} — trafi do planowania produkcji.'
        ),
    )


def bake_spec_deleted(request, product, before):
    record_event(
        request, category=CATEGORY, action='bake_spec.deleted', obj=product, object_label=product.name,
        changes=field_changes(before, {}, BAKE_SPEC_LABELS),
        description=f'Odłączono wyrób {product.name} od produkcji — nie będzie trafiał do planów.',
    )
