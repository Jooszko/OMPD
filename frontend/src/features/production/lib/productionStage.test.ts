import { describe, expect, it } from 'vitest';
import type { ProductionBatch } from '../../../services/api';
import {
  countByStage,
  formatAmount,
  getBatchAction,
  getStageTimer,
  sortBatchesForBoard,
} from './productionStage';

let nextId = 1;

function makeBatch(overrides: Partial<ProductionBatch> = {}): ProductionBatch {
  return {
    batch_id: nextId++,
    dough_id: 1,
    dough_name: 'Ciasto pszenne',
    sequence: 1,
    batch_count: 1,
    dough_mass_kg: 50,
    mixer_name: 'Spiralna',
    stage: 'mixing',
    stage_label: 'Mieszanie',
    next_stage: 'dividing',
    next_stage_label: 'Dzielenie / formowanie',
    stage_started_at: null,
    stage_worker: null,
    completed_at: null,
    mixing: { instructions: '', mixing_time_min: 12, target_dough_temp_c: 26 },
    proofing_time_min: 45,
    ingredients: [],
    outputs: [
      { product_id: 1, product_name: 'Chleb', planned_pieces: 10, waste_pieces: 0, good_pieces: 10,
        piece_weight_kg: 0.5, bake_temp_c: 230, bake_time_min: 35 },
      { product_id: 2, product_name: 'Bułka', planned_pieces: 40, waste_pieces: 0, good_pieces: 40,
        piece_weight_kg: 0.09, bake_temp_c: 240, bake_time_min: 14 },
    ],
    history: [],
    waste: [],
    ...overrides,
  };
}

describe('getBatchAction', () => {
  it('offers to start a stage that has not begun', () => {
    expect(getBatchAction(makeBatch())).toEqual({ kind: 'start', label: 'Zacznij: Mieszanie' });
  });

  it('offers to move on once the stage is in progress', () => {
    const batch = makeBatch({ stage_started_at: '2026-10-09T20:00:00Z' });
    expect(getBatchAction(batch)).toEqual({ kind: 'advance', label: 'Dalej: Dzielenie' });
  });

  it('labels the last step as finishing the batch', () => {
    const batch = makeBatch({ stage: 'baking', next_stage: 'done', stage_started_at: '2026-10-09T20:00:00Z' });
    expect(getBatchAction(batch).label).toBe('Zakończ partię');
  });

  it('has no action for a finished batch', () => {
    expect(getBatchAction(makeBatch({ stage: 'done', next_stage: null })).kind).toBe('none');
  });
});

describe('getStageTimer', () => {
  const start = '2026-10-09T20:00:00Z';
  const at = (minutes: number) => new Date(start).getTime() + minutes * 60000;

  it('is empty while the stage waits', () => {
    expect(getStageTimer(makeBatch(), at(5))).toBeNull();
  });

  it('flags mixing that runs over the dough norm', () => {
    const batch = makeBatch({ stage_started_at: start });
    expect(getStageTimer(batch, at(10))).toEqual({ elapsed: 10, target: 12, overdue: false });
    expect(getStageTimer(batch, at(13))?.overdue).toBe(true);
  });

  it('uses the longest bake time of the batch products', () => {
    const batch = makeBatch({ stage: 'baking', stage_started_at: start });
    expect(getStageTimer(batch, at(20))?.target).toBe(35);
  });

  it('has no norm for dividing', () => {
    const batch = makeBatch({ stage: 'dividing', stage_started_at: start });
    expect(getStageTimer(batch, at(90))).toEqual({ elapsed: 90, target: null, overdue: false });
  });
});

describe('sortBatchesForBoard', () => {
  it('puts work in progress first and finished batches last', () => {
    const done = makeBatch({ stage: 'done' });
    const waiting = makeBatch({ stage: 'mixing' });
    const waitingLater = makeBatch({ stage: 'proofing' });
    const active = makeBatch({ stage: 'dividing', stage_started_at: '2026-10-09T20:00:00Z' });

    expect(sortBatchesForBoard([done, waiting, waitingLater, active])).toEqual([active, waitingLater, waiting, done]);
  });
});

describe('countByStage', () => {
  it('counts every stage including empty ones', () => {
    const counts = countByStage([makeBatch(), makeBatch(), makeBatch({ stage: 'done' })]);
    expect(counts).toEqual({ mixing: 2, dividing: 0, proofing: 0, baking: 0, done: 1 });
  });
});

describe('formatAmount', () => {
  it('shows small masses in grams so they are easy to weigh', () => {
    expect(formatAmount(0.35, 'kg')).toBe('350 g');
    expect(formatAmount(0.5, 'l')).toBe('500 ml');
    expect(formatAmount(3, 'szt')).toBe('3 szt');
  });
});
