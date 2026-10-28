import { describe, expect, it } from 'vitest';
import type { CoverageRow, PlanPreview, PlanPreviewDough } from '../../../services/api';
import { coverageProgress, ingredientNeeds, mixerLoad, needBar, peakLoad, splitCoverage, totals } from './planning';

const mixer = { mixer_id: 1, name: 'Spiralna', min_capacity_kg: 20, max_capacity_kg: 100 };

function dough(masses: number[], overrides: Partial<PlanPreviewDough> = {}): PlanPreviewDough {
  return {
    dough_id: 1,
    name: 'Ciasto pszenne',
    loss_buffer_pct: 2,
    raw_mass_kg: 0,
    total_mass_kg: masses.reduce((a, b) => a + b, 0),
    mixer,
    products: [{ product_id: 1, product_name: 'Chleb', ordered_qty: 10, piece_weight_kg: 0.5, raw_mass_kg: 5, bake_temp_c: 230, bake_time_min: 40 }],
    batches: masses.map((mass, index) => ({ sequence: index + 1, dough_mass_kg: mass, outputs: [], ingredients: [] })),
    warnings: [],
    notes: [],
    ...overrides,
  };
}

function coverage(product: string, ordered: number, finished: number, shortfall: number): CoverageRow {
  return {
    product_id: product.length,
    product_name: product,
    ordered_qty: ordered,
    planned_qty: ordered,
    waste_qty: 0,
    expected_qty: ordered - shortfall,
    finished_qty: finished,
    shortfall,
  };
}

describe('mixerLoad', () => {
  it('classifies the batch mass against mixer capacity', () => {
    expect(mixerLoad(50, mixer)).toEqual({ pct: 50, minPct: 20, state: 'ok' });
    expect(mixerLoad(10, mixer)?.state).toBe('under');
    expect(mixerLoad(120, mixer)?.state).toBe('over');
    expect(mixerLoad(50, null)).toBeNull();
  });

  it('uses the heaviest batch for the dough tile', () => {
    expect(peakLoad(dough([40, 90, 60]))?.pct).toBe(90);
    expect(peakLoad(dough([]))).toBeNull();
  });
});

describe('totals', () => {
  it('sums batches, mass and ordered pieces across doughs', () => {
    const preview = { doughs: [dough([40, 60]), dough([30])] } as PlanPreview;
    expect(totals(preview)).toEqual({ batches: 3, massKg: 130, pieces: 20 });
  });
});

describe('ingredientNeeds', () => {
  it('flags shortages and stock that would fall below minimum, most urgent first', () => {
    const needs = ingredientNeeds([
      { ingredient_id: 1, name: 'Sól', unit: 'kg', amount: 2, current_stock: 50, min_stock_level: 10, shortage: 0 },
      { ingredient_id: 2, name: 'Mąka', unit: 'kg', amount: 500, current_stock: 400, min_stock_level: 1000, shortage: 100 },
      { ingredient_id: 3, name: 'Drożdże', unit: 'kg', amount: 5, current_stock: 20, min_stock_level: 30, shortage: 0 },
    ]);

    expect(needs.map((need) => [need.name, need.state])).toEqual([
      ['Mąka', 'shortage'],
      ['Drożdże', 'below_min'],
      ['Sól', 'ok'],
    ]);
    expect(needs[0].after).toBe(-100);
  });

  it('puts need, stock and minimum on one scale', () => {
    const [need] = ingredientNeeds([
      { ingredient_id: 1, name: 'Mąka', unit: 'kg', amount: 50, current_stock: 200, min_stock_level: 100, shortage: 0 },
    ]);
    expect(needBar(need)).toEqual({ amount: 0.25, current: 1, minimum: 0.5 });
  });
});

describe('coverage', () => {
  it('puts the biggest shortfalls first and keeps covered products apart', () => {
    const { short, covered } = splitCoverage([
      coverage('Chleb', 100, 100, 0),
      coverage('Bułka', 50, 40, 2),
      coverage('Bagietka', 80, 60, 7),
    ]);
    expect(short.map((row) => row.product_name)).toEqual(['Bagietka', 'Bułka']);
    expect(covered.map((row) => row.product_name)).toEqual(['Chleb']);
  });

  it('caps progress at 100%', () => {
    expect(coverageProgress(coverage('Chleb', 10, 12, 0))).toBe(1);
    expect(coverageProgress(coverage('Chleb', 10, 5, 0))).toBe(0.5);
  });
});
