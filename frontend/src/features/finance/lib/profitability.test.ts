import { describe, expect, it } from 'vitest';
import type { ProfitabilityProduct } from '../../../services/api';
import { groupByMargin, lowestMargin, marginLevel, profitRanking } from './profitability';

function product(name: string, fields: Partial<ProfitabilityProduct> = {}): ProfitabilityProduct {
  return {
    product_id: name.length,
    name,
    category_label: 'Chleby',
    price: '8.00',
    unit_cost: '2.00',
    unit_margin: '6.00',
    margin_pct: 75,
    sold: 10,
    revenue: '80.00',
    period_margin: '60.00',
    has_recipe: true,
    missing_prices: [],
    ...fields,
  };
}

describe('marginLevel', () => {
  it.each<[Partial<ProfitabilityProduct>, string]>([
    [{ margin_pct: 75 }, 'high'],
    [{ margin_pct: 50 }, 'high'],
    [{ margin_pct: 30 }, 'medium'],
    [{ margin_pct: 12 }, 'low'],
    [{ missing_prices: ['Masło'] }, 'incomplete'],
    [{ has_recipe: false, margin_pct: null, unit_cost: null }, 'no_recipe'],
  ])('%o → %s', (fields, level) => {
    expect(marginLevel(product('X', fields))).toBe(level);
  });
});

describe('groupByMargin', () => {
  it('keeps only non-empty groups and sorts each by period margin', () => {
    const groups = groupByMargin([
      product('Chleb', { period_margin: '60.00' }),
      product('Bułka', { period_margin: '90.00', margin_pct: 66 }),
      product('Maślana', { margin_pct: 12 }),
    ]);

    expect(groups.map((g) => [g.level, g.items.map((p) => p.name)])).toEqual([
      ['high', ['Bułka', 'Chleb']],
      ['low', ['Maślana']],
    ]);
  });
});

describe('ranking and lowest margin', () => {
  const products = [
    product('Chleb', { period_margin: '60.00' }),
    product('Bułka', { period_margin: '90.00', margin_pct: 66 }),
    product('Maślana', { margin_pct: 12, period_margin: '5.00' }),
    product('Rogal', { sold: 0, period_margin: '0.00' }),
    product('Chałka', { missing_prices: ['Masło'], period_margin: '500.00' }),
  ];

  it('ranks complete products that sold something', () => {
    expect(profitRanking(products).map((p) => p.name)).toEqual(['Bułka', 'Chleb', 'Maślana']);
  });

  it('finds the lowest margin among complete products', () => {
    expect(lowestMargin(products)?.name).toBe('Maślana');
    expect(lowestMargin([])).toBeNull();
  });
});