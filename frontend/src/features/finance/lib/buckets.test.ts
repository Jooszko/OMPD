import { describe, expect, it } from 'vitest';
import type { FinanceOverviewDay } from '../../../services/api';
import { bucketDays, bucketLabel, bucketSizeFor } from './buckets';

function day(date: string, revenue: number, cogs: number, expenses: [string, number][] = []): FinanceOverviewDay {
  const operating = expenses.reduce((sum, [, amount]) => sum + amount, 0);
  return {
    date,
    revenue: String(revenue),
    cogs: String(cogs),
    operating_expenses: String(operating),
    net_profit: String(revenue - cogs - operating),
    cumulative_profit: '0',
    expenses: expenses.map(([label, amount]) => ({ category: label, label, amount: String(amount) })),
  };
}

describe('bucketSizeFor', () => {
  it.each([
    [7, 'day'],
    [14, 'day'],
    [30, 'week'],
    [92, 'week'],
    [180, 'month'],
  ] as const)('uses %i days → %s', (count, size) => {
    expect(bucketSizeFor(count)).toBe(size);
  });
});

describe('bucketLabel', () => {
  it.each([
    ['2026-09-14', '2026-09-14', 'day', '14.09'],
    ['2026-09-14', '2026-09-20', 'week', '14–20.09'],
    ['2026-09-28', '2026-10-04', 'week', '28.09–04.10'],
  ] as const)('labels %s – %s as %s', (start, end, size, expected) => {
    expect(bucketLabel(start, end, size)).toBe(expected);
  });

  it('names months in Polish', () => {
    expect(bucketLabel('2026-09-01', '2026-09-30', 'month')).toBe('wrz 2026');
  });
});

describe('bucketDays', () => {
  it('groups Monday–Sunday weeks clipped to the period and sums costs', () => {
    const days = [
      day('2026-09-19', 100, 40), // sobota
      day('2026-09-20', 50, 20, [['Paliwo', 10]]), // niedziela
      day('2026-09-21', 200, 80, [['Wynagrodzenia', 500], ['Paliwo', 5]]), // poniedziałek
      day('2026-09-22', 120, 50, [['Paliwo', 15]]),
    ];

    const buckets = bucketDays(days, 'week');

    expect(buckets.map((b) => [b.start, b.end, b.label])).toEqual([
      ['2026-09-19', '2026-09-20', '19–20.09'],
      ['2026-09-21', '2026-09-22', '21–22.09'],
    ]);
    expect(buckets[0]).toMatchObject({ revenue: 150, costs: 70, result: 80 });
    expect(buckets[1]).toMatchObject({ revenue: 320, cogs: 130, operating: 520, costs: 650, result: -330 });
    expect(buckets[1].expenses).toEqual([
      { label: 'Wynagrodzenia', amount: 500 },
      { label: 'Paliwo', amount: 20 },
    ]);
  });

  it('keeps one bucket per day for short periods', () => {
    expect(bucketDays([day('2026-09-19', 1, 0), day('2026-09-20', 2, 0)], 'day')).toHaveLength(2);
  });
});