import type { CoverageRow, PlanCalendarStatus, PlanPreview, PlanPreviewDough } from '../../../services/api';

export const CALENDAR_LABELS: Record<PlanCalendarStatus, string> = {
  none: 'Bez planu',
  saved: 'Plan zapisany',
  in_progress: 'W realizacji',
  done: 'Zrealizowany',
};

export const CALENDAR_COLORS: Record<PlanCalendarStatus, string> = {
  none: '#b3aca9',
  saved: '#5b9be6',
  in_progress: '#f49f1c',
  done: '#3fb565',
};

export type MixerLoad = 'under' | 'ok' | 'over';

export const MIXER_LOAD_COLORS: Record<MixerLoad, string> = {
  under: '#f49f1c',
  ok: '#3fb565',
  over: '#e5484d',
};

export const MIXER_LOAD_LABELS: Record<MixerLoad, string> = {
  under: 'Poniżej min. wsadu',
  ok: 'W zakresie mieszałki',
  over: 'Ponad pojemność',
};

type Mixer = NonNullable<PlanPreviewDough['mixer']>;

export function mixerLoad(massKg: number, mixer: Mixer | null): { pct: number; minPct: number; state: MixerLoad } | null {
  if (!mixer || Number(mixer.max_capacity_kg) <= 0) return null;
  const max = Number(mixer.max_capacity_kg);
  const min = Number(mixer.min_capacity_kg);
  const pct = (massKg / max) * 100;
  const state: MixerLoad = massKg > max ? 'over' : massKg < min ? 'under' : 'ok';
  return { pct, minPct: (min / max) * 100, state };
}

/** Najbardziej obciążona dzieża ciasta – jej wsad pokazuje kafel. */
export function peakLoad(dough: PlanPreviewDough) {
  const masses = dough.batches.map((batch) => Number(batch.dough_mass_kg));
  if (masses.length === 0) return null;
  return mixerLoad(Math.max(...masses), dough.mixer);
}

export function totals(preview: PlanPreview) {
  return {
    batches: preview.doughs.reduce((sum, dough) => sum + dough.batches.length, 0),
    massKg: preview.doughs.reduce((sum, dough) => sum + Number(dough.total_mass_kg), 0),
    pieces: preview.doughs.reduce((sum, dough) => sum + dough.products.reduce((s, p) => s + p.ordered_qty, 0), 0),
  };
}

export type NeedState = 'shortage' | 'below_min' | 'ok';

export const NEED_LABELS: Record<NeedState, string> = {
  shortage: 'Brakuje na zmianę',
  below_min: 'Po zmianie poniżej minimum',
  ok: 'Wystarczy',
};

export const NEED_COLORS: Record<NeedState, string> = {
  shortage: '#e5484d',
  below_min: '#f49f1c',
  ok: '#3fb565',
};

export interface IngredientNeed {
  id: number;
  name: string;
  unit: string;
  amount: number;
  current: number;
  minimum: number;
  after: number;
  state: NeedState;
}

export function ingredientNeeds(rows: PlanPreview['ingredient_totals']): IngredientNeed[] {
  const order: NeedState[] = ['shortage', 'below_min', 'ok'];
  return rows
    .map((row) => {
      const amount = Number(row.amount);
      const current = Number(row.current_stock);
      const minimum = Number(row.min_stock_level);
      const after = current - amount;
      const state: NeedState = after < 0 ? 'shortage' : after < minimum ? 'below_min' : 'ok';
      return { id: row.ingredient_id, name: row.name, unit: row.unit, amount, current, minimum, after, state };
    })
    .sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state) || b.amount / (b.current || 1) - a.amount / (a.current || 1));
}

/** Pozycje paska surowca na wspólnej skali: zapotrzebowanie, stan i minimum. */
export function needBar(need: IngredientNeed): { amount: number; current: number; minimum: number } {
  const scale = Math.max(need.amount, need.current, need.minimum) || 1;
  return { amount: need.amount / scale, current: need.current / scale, minimum: need.minimum / scale };
}

export function coverageProgress(row: CoverageRow): number {
  if (row.ordered_qty <= 0) return 1;
  return Math.min(1, row.finished_qty / row.ordered_qty);
}

export function splitCoverage(rows: CoverageRow[]): { short: CoverageRow[]; covered: CoverageRow[] } {
  const short = rows.filter((row) => row.shortfall > 0).sort((a, b) => b.shortfall - a.shortfall);
  const covered = rows.filter((row) => row.shortfall <= 0);
  return { short, covered };
}

export function formatPieces(value: number): string {
  return `${value.toLocaleString('pl-PL')} szt.`;
}

export function weekdayShort(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('pl-PL', { weekday: 'short' }).replace('.', '');
}

export function dayOfMonth(isoDate: string): string {
  return String(Number(isoDate.slice(8, 10)));
}

export function monthShort(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('pl-PL', { month: 'short' }).replace('.', '');
}
