import { describe, expect, it } from 'vitest';
import { formatAxisMoney, niceRange } from './chart';

describe('niceRange', () => {
  it('starts at zero for positive values and rounds the top up', () => {
    expect(niceRange([1200, 18_340, 9000])).toEqual({ min: 0, max: 20_000, ticks: [0, 5000, 10_000, 15_000, 20_000] });
  });

  it('includes negative values below zero', () => {
    expect(niceRange([-3400, 1200, 6100])).toEqual({ min: -5000, max: 7500, ticks: [-5000, -2500, 0, 2500, 5000, 7500] });
  });

  it('falls back to a default range when everything is zero', () => {
    expect(niceRange([0, 0])).toEqual({ min: 0, max: 100, ticks: [0, 50, 100] });
  });
});

describe('formatAxisMoney', () => {
  it.each([
    [0, '0 zł'],
    [500, '500 zł'],
    [5000, '5 tys.'],
    [2500, '2,5 tys.'],
    [-10_000, '−10 tys.'],
  ])('formats %d', (value, expected) => {
    expect(formatAxisMoney(value)).toBe(expected);
  });
});