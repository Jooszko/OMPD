import { describe, expect, it } from 'vitest';
import { formatMinutes, formatPercent, niceTicks } from './statsFormat';

describe('formatPercent', () => {
  it.each([
    [66.7, '66,7%'],
    [100, '100%'],
    [0, '0%'],
  ])('formats %d as %s', (value, expected) => {
    expect(formatPercent(value)).toBe(expected);
  });

  it('shows a dash when there is no data', () => {
    expect(formatPercent(null)).toBe('—');
  });
});

describe('formatMinutes', () => {
  it.each([
    [45.4, '45 min'],
    [60, '1 godz'],
    [125, '2 godz 5 min'],
    [null, '—'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatMinutes(value)).toBe(expected);
  });
});

describe('niceTicks', () => {
  it.each([
    [37, [0, 10, 20, 30, 40]],
    [3, [0, 1, 2, 3]],
    [8, [0, 2, 4, 6, 8]],
    [0, [0, 1]],
  ])('builds round ticks up to at least %d', (max, expected) => {
    expect(niceTicks(max)).toEqual(expected);
  });
});