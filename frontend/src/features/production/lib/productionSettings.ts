/** Pomocnicze funkcje formularzy ustawień produkcji (bez Reacta — testowane osobno). */

/** Liczba z pola tekstowego; akceptuje przecinek dziesiętny. Puste lub niepoprawne → null. */
export function parseDecimal(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface MixerDraft {
  name: string;
  min_capacity_kg: string;
  max_capacity_kg: string;
}

export function validateMixer(draft: MixerDraft): string | null {
  if (!draft.name.trim()) return 'Podaj nazwę mieszałki.';
  const min = parseDecimal(draft.min_capacity_kg);
  const max = parseDecimal(draft.max_capacity_kg);
  if (max === null || max <= 0) return 'Maksymalny wsad musi być większy od zera.';
  if (min === null || min < 0) return 'Minimalny wsad nie może być pusty ani ujemny.';
  if (min > max) return 'Minimalny wsad nie może być większy od maksymalnego.';
  return null;
}

export interface RecipeDraftItem {
  ingredient_id: number | '';
  amount_per_kg: string;
}

export interface DoughDraft {
  name: string;
  loss_buffer_pct: string;
  mixing_time_min: string;
  target_dough_temp_c: string;
  proofing_time_min: string;
  ingredients: RecipeDraftItem[];
}

export function validateDough(draft: DoughDraft): string | null {
  if (!draft.name.trim()) return 'Podaj nazwę ciasta.';
  const buffer = parseDecimal(draft.loss_buffer_pct);
  if (buffer === null || buffer < 0 || buffer >= 100) return 'Bufor strat musi mieścić się w przedziale 0–99%.';
  for (const [label, value] of [
    ['Czas mieszania', draft.mixing_time_min],
    ['Czas garowania', draft.proofing_time_min],
  ] as const) {
    const minutes = parseDecimal(value);
    if (minutes === null || minutes < 0 || !Number.isInteger(minutes)) return `${label} podaj w pełnych minutach.`;
  }
  if (parseDecimal(draft.target_dough_temp_c) === null) return 'Podaj docelową temperaturę ciasta.';
  if (draft.ingredients.length === 0) return 'Receptura musi mieć co najmniej jeden surowiec.';
  const ids = new Set<number>();
  for (const item of draft.ingredients) {
    if (item.ingredient_id === '') return 'Wybierz surowiec w każdym wierszu receptury.';
    if (ids.has(item.ingredient_id)) return 'Każdy surowiec może wystąpić w recepturze tylko raz.';
    ids.add(item.ingredient_id);
    const amount = parseDecimal(item.amount_per_kg);
    if (amount === null || amount <= 0) return 'Ilość surowca na 1 kg ciasta musi być większa od zera.';
  }
  return null;
}

/**
 * Masa surowców liczonych wagowo (kg, l ≈ kg) na 1 kg ciasta. Dla kompletnej receptury wynosi ok. 1,0 —
 * odchylenie podpowiada pomyłkę o rząd wielkości (np. gramy wpisane jako kilogramy).
 */
export function recipeMassPerKg(items: RecipeDraftItem[], unitOf: (ingredientId: number) => string | undefined): number {
  return items.reduce((sum, item) => {
    if (item.ingredient_id === '') return sum;
    const unit = unitOf(item.ingredient_id);
    const amount = parseDecimal(item.amount_per_kg);
    return unit === 'kg' || unit === 'l' ? sum + (amount ?? 0) : sum;
  }, 0);
}

export function recipeMassLooksWrong(massPerKg: number): boolean {
  return massPerKg > 0 && (massPerKg < 0.9 || massPerKg > 1.1);
}

export interface BakeSpecDraft {
  dough_id: number | '';
  piece_weight_kg: string;
  bake_temp_c: string;
  bake_time_min: string;
}

export function validateBakeSpec(draft: BakeSpecDraft): string | null {
  if (draft.dough_id === '') return 'Wybierz ciasto.';
  const weight = parseDecimal(draft.piece_weight_kg);
  if (weight === null || weight <= 0) return 'Waga kęsa musi być większa od zera.';
  const temp = parseDecimal(draft.bake_temp_c);
  if (temp === null || temp <= 0 || !Number.isInteger(temp)) return 'Podaj temperaturę wypieku w pełnych stopniach.';
  const minutes = parseDecimal(draft.bake_time_min);
  if (minutes === null || minutes <= 0 || !Number.isInteger(minutes)) return 'Podaj czas wypieku w pełnych minutach.';
  return null;
}
