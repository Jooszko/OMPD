import { describe, expect, it } from 'vitest';
import type { ProductBakeSpecRow, ProductionDough } from '../../../services/api';
import {
  groupByDough,
  parseDecimal,
  productMatches,
  recipeMassLooksWrong,
  recipeMassPerKg,
  suggestionVerdict,
  validateBakeSpec,
  validateDough,
  validateMixer,
  type DoughDraft,
} from './productionSettings';

const dough = (overrides: Partial<DoughDraft> = {}): DoughDraft => ({
  name: 'Ciasto pszenne',
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

describe('suggestionVerdict', () => {
  it('ocenia zgodność względem progu z backendu', () => {
    expect(suggestionVerdict(1, 0.8)).toBe('very_good');
    expect(suggestionVerdict(0.95, 0.8)).toBe('very_good');
    expect(suggestionVerdict(0.86, 0.8)).toBe('good');
    expect(suggestionVerdict(0.8, 0.8)).toBe('good');
    expect(suggestionVerdict(0.79, 0.8)).toBe('weak');
  });
});

const product = (id: number, name: string, doughId: number | null, category = 'bread'): ProductBakeSpecRow => ({
  product_id: id,
  product_name: name,
  category,
  spec:
    doughId === null
      ? null
      : { dough_id: doughId, dough_name: doughId === 1 ? 'Ciasto pszenne' : 'Ciasto razowe', piece_weight_kg: '0.58', bake_temp_c: 230, bake_time_min: 35 },
});

const doughRow = (id: number, name: string): ProductionDough => ({
  dough_id: id,
  name,
  mixer_id: null,
  loss_buffer_pct: '5.00',
  mixing_time_min: 10,
  target_dough_temp_c: '26',
  proofing_time_min: 45,
  mixing_instructions: '',
  ingredients: [],
  products_count: 0,
  is_locked: false,
});

describe('productMatches', () => {
  it('szuka w nazwie, kategorii i cieście bez względu na wielkość liter', () => {
    const row = product(1, 'Bagietka francuska', 1);
    expect(productMatches(row, '')).toBe(true);
    expect(productMatches(row, 'BAGIET')).toBe(true);
    expect(productMatches(row, 'chleby')).toBe(true);
    expect(productMatches(row, 'pszenne')).toBe(true);
    expect(productMatches(row, 'razowe')).toBe(false);
  });

  it('wyrób bez ciasta nie dopasowuje się do nazwy ciasta', () => {
    expect(productMatches(product(2, 'Bułka z serem', null, 'buns'), 'ciasto')).toBe(false);
  });
});

describe('groupByDough', () => {
  it('grupuje według kolejności ciast, sortuje wyroby i pomija puste grupy oraz wyroby bez ciasta', () => {
    const groups = groupByDough(
      [product(1, 'Chleb pszenny', 1), product(2, 'Bagietka', 1), product(3, 'Bułka z serem', null)],
      [doughRow(2, 'Ciasto razowe'), doughRow(1, 'Ciasto pszenne')]
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Ciasto pszenne');
    expect(groups[0].rows.map((row) => row.product_name)).toEqual(['Bagietka', 'Chleb pszenny']);
  });
});
