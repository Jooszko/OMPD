import type { CoverageRow, ProductionBatch, ProductionStage } from '../../../services/api';

export const STAGE_ORDER: ProductionStage[] = ['mixing', 'dividing', 'proofing', 'baking', 'done'];

export const STAGE_LABELS: Record<ProductionStage, string> = {
  mixing: 'Mieszanie',
  dividing: 'Dzielenie / formowanie',
  proofing: 'Garowanie',
  baking: 'Wypiek',
  done: 'Zakończona',
};

export const STAGE_SHORT_LABELS: Record<ProductionStage, string> = {
  mixing: 'Mieszanie',
  dividing: 'Dzielenie',
  proofing: 'Garowanie',
  baking: 'Wypiek',
  done: 'Gotowe',
};

export const STAGE_COLORS: Record<ProductionStage, string> = {
  mixing: 'bg-sky-700 text-white',
  dividing: 'bg-violet-700 text-white',
  proofing: 'bg-amber-500 text-black',
  baking: 'bg-red-700 text-white',
  done: 'bg-emerald-700 text-white',
};

export type BatchAction =
  | { kind: 'start'; label: string }
  | { kind: 'advance'; label: string }
  | { kind: 'none'; label: string };

export function getBatchAction(batch: ProductionBatch): BatchAction {
  if (batch.stage === 'done') return { kind: 'none', label: 'Partia zakończona' };
  if (!batch.stage_started_at) return { kind: 'start', label: `Zacznij: ${STAGE_SHORT_LABELS[batch.stage]}` };
  if (batch.next_stage === 'done') return { kind: 'advance', label: 'Zakończ partię' };
  return { kind: 'advance', label: `Dalej: ${STAGE_SHORT_LABELS[batch.next_stage ?? 'done']}` };
}

export function stageTargetMinutes(batch: ProductionBatch): number | null {
  switch (batch.stage) {
    case 'mixing':
      return batch.mixing.mixing_time_min;
    case 'proofing':
      return batch.proofing_time_min;
    case 'baking':
      return batch.outputs.length ? Math.max(...batch.outputs.map((o) => o.bake_time_min)) : null;
    default:
      return null;
  }
}

export function elapsedMinutes(startedAt: string | null, now: number): number | null {
  if (!startedAt) return null;
  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60000));
}

export type StageTimer = { elapsed: number; target: number | null; overdue: boolean };

export function getStageTimer(batch: ProductionBatch, now: number): StageTimer | null {
  const elapsed = elapsedMinutes(batch.stage_started_at, now);
  if (elapsed === null) return null;
  const target = stageTargetMinutes(batch);
  return { elapsed, target, overdue: target !== null && elapsed > target };
}

export function countByStage(batches: ProductionBatch[]): Record<ProductionStage, number> {
  const counts = Object.fromEntries(STAGE_ORDER.map((s) => [s, 0])) as Record<ProductionStage, number>;
  for (const batch of batches) counts[batch.stage] += 1;
  return counts;
}

export function sortBatchesForBoard(batches: ProductionBatch[]): ProductionBatch[] {
  const rank = (b: ProductionBatch) => {
    if (b.stage === 'done') return 2;
    return b.stage_started_at ? 0 : 1;
  };
  return [...batches].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      STAGE_ORDER.indexOf(b.stage) - STAGE_ORDER.indexOf(a.stage) ||
      a.dough_name.localeCompare(b.dough_name, 'pl') ||
      a.sequence - b.sequence
  );
}

export function shortfallRows(coverage: CoverageRow[]): CoverageRow[] {
  return coverage.filter((row) => row.shortfall > 0);
}

export function formatKg(value: number): string {
  return `${Number(value).toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 3 })} kg`;
}

export function formatAmount(value: number, unit: string): string {
  if (unit === 'kg' && value < 1) return `${Math.round(value * 1000)} g`;
  if (unit === 'l' && value < 1) return `${Math.round(value * 1000)} ml`;
  return `${Number(value).toLocaleString('pl-PL', { maximumFractionDigits: 3 })} ${unit}`;
}
