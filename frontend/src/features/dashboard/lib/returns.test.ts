import { describe, expect, it } from 'vitest';
import type { StopReturns } from '../../../services/api';
import {
  applyReturnQuantities,
  clampReturnQuantity,
  initialReturnQuantities,
  summarizeReturns,
} from './returns';

const returns: StopReturns = {
  source_date: '2026-10-07',
  items: [
    { product_id: 1, product_name: 'Bułka', delivered_quantity: 10, returned_quantity: 2, unit_price: '0.90' },
    { product_id: 2, product_name: 'Chleb', delivered_quantity: 4, returned_quantity: 0, unit_price: '4.50' },
  ],
};

describe('initialReturnQuantities', () => {
  it('starts from quantities already recorded', () => {
    expect(initialReturnQuantities(returns)).toEqual({ 1: 2, 2: 0 });
  });
});

describe('summarizeReturns', () => {
  it('sums recorded returns by default', () => {
    expect(summarizeReturns(returns)).toEqual({ count: 2, value: 1.8 });
  });

  it('uses edited quantities and rounds to grosze', () => {
    expect(summarizeReturns(returns, { 1: 3, 2: 1 })).toEqual({ count: 4, value: 7.2 });
  });
});

describe('applyReturnQuantities', () => {
  it('writes quantities into the stop and treats missing ones as zero', () => {
    const result = applyReturnQuantities(returns, { 2: 1 });
    expect(result.items.map((item) => item.returned_quantity)).toEqual([0, 1]);
    expect(result.source_date).toBe('2026-10-07');
  });
});

describe('clampReturnQuantity', () => {
  it.each([
    [5, 10, 5],
    [12, 10, 10],
    [-3, 10, 0],
    [2.7, 10, 2],
    [Number.NaN, 10, 0],
  ])('clamps %d to the range 0..%d as %d', (raw, max, expected) => {
    expect(clampReturnQuantity(raw, max)).toBe(expected);
  });
});