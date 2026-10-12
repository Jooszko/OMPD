import { describe, expect, it } from 'vitest';
import {
  parseDecimal,
  recipeMassLooksWrong,
  recipeMassPerKg,
  validateBakeSpec,
  validateDough,
  validateMixer,
  type DoughDraft,
} from './productionSettings';

const dough = (overrides: Partial<DoughDraft> = {}): DoughDraft => ({
  name: 'Ciasto pszenne',
  loss_buffer_pct: '3',
  mixing_time_min: '12',
  target_dough_temp_c: '26',
  proofing_time_min: '50',
  ingredients: [
    { ingredient_id: 1, amount_per_kg: '0,611' },
    { ingredient_id: 2, amount_per_kg: '0.367' },
  ],
  ...overrides,
});

describe('parseDecimal', () => {
  it('accepts a comma as decimal separator', () => {
    expect(parseDecimal('0,25')).toBe(0.25);
  });

  it('returns null for empty or invalid input', () => {
    expect(parseDecimal('  ')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
  });
});

describe('validateMixer', () => {
  it('accepts a valid mixer', () => {
    expect(validateMixer({ name: 'Duża', min_capacity_kg: '20', max_capacity_kg: '120' })).toBeNull();
  });

  it('rejects minimum above maximum', () => {
    expect(validateMixer({ name: 'Duża', min_capacity_kg: '50', max_capacity_kg: '40' })).toMatch(/Minimalny/);
  });

  it('rejects missing maximum', () => {
    expect(validateMixer({ name: 'Duża', min_capacity_kg: '0', max_capacity_kg: '' })).toMatch(/Maksymalny/);
  });
});

describe('validateDough', () => {
  it('accepts a valid dough', () => {
    expect(validateDough(dough())).toBeNull();
  });

  it('rejects duplicate ingredients', () => {
    const duplicated = dough({
      ingredients: [
        { ingredient_id: 1, amount_per_kg: '0.5' },
        { ingredient_id: 1, amount_per_kg: '0.5' },
      ],
    });
    expect(validateDough(duplicated)).toMatch(/tylko raz/);
  });

  it('rejects an empty recipe and unselected rows', () => {
    expect(validateDough(dough({ ingredients: [] }))).toMatch(/co najmniej jeden/);
    expect(validateDough(dough({ ingredients: [{ ingredient_id: '', amount_per_kg: '1' }] }))).toMatch(/Wybierz/);
  });

  it('rejects fractional minutes', () => {
    expect(validateDough(dough({ mixing_time_min: '7.5' }))).toMatch(/pełnych minutach/);
  });
});

describe('recipeMassPerKg', () => {
  const units: Record<number, string> = { 1: 'kg', 2: 'l', 3: 'szt' };

  it('sums weighed ingredients and skips piece-counted ones', () => {
    const mass = recipeMassPerKg(
      [
        { ingredient_id: 1, amount_per_kg: '0.6' },
        { ingredient_id: 2, amount_per_kg: '0.4' },
        { ingredient_id: 3, amount_per_kg: '2' },
      ],
      (id) => units[id]
    );
    expect(mass).toBeCloseTo(1.0);
    expect(recipeMassLooksWrong(mass)).toBe(false);
  });

  it('flags a recipe that is an order of magnitude off', () => {
    expect(recipeMassLooksWrong(0.1)).toBe(true);
    expect(recipeMassLooksWrong(0)).toBe(false);
  });
});

describe('validateBakeSpec', () => {
  it('requires a dough and positive values', () => {
    expect(validateBakeSpec({ dough_id: '', piece_weight_kg: '0.5', bake_temp_c: '230', bake_time_min: '35' })).toMatch(
      /ciasto/
    );
    expect(validateBakeSpec({ dough_id: 1, piece_weight_kg: '0', bake_temp_c: '230', bake_time_min: '35' })).toMatch(
      /Waga/
    );
    expect(validateBakeSpec({ dough_id: 1, piece_weight_kg: '0,58', bake_temp_c: '230', bake_time_min: '35' })).toBeNull();
  });
});
