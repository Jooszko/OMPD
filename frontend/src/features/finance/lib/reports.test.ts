import { describe, expect, it } from 'vitest';
import type { StatementLine } from '../../../services/api';
import { calendarCells, canGoForward, compactMoney, dayTone, isCostLine, periodStart, shiftPeriod } from './reports';

describe('periods', () => {
  it('finds the start of month, quarter and year', () => {
    expect(periodStart('month', '2026-08-17')).toBe('2026-08-01');
    expect(periodStart('quarter', '2026-08-17')).toBe('2026-07-01');
    expect(periodStart('year', '2026-08-17')).toBe('2026-01-01');
  });

  it.each([
    ['month', '2026-01-20', -1, '2025-12-01'],
    ['month', '2026-12-05', 1, '2027-01-01'],
    ['quarter', '2026-02-10', -1, '2025-10-01'],
    ['quarter', '2026-08-10', 1, '2026-10-01'],
    ['year', '2026-08-10', -1, '2025-01-01'],
  ] as const)('%s %s shifted by %i → %s', (kind, anchor, direction, expected) => {
    expect(shiftPeriod(kind, anchor, direction)).toBe(expected);
  });

  it('does not go past the current period', () => {
    expect(canGoForward('month', '2026-09-15', '2026-10-14')).toBe(true);
    expect(canGoForward('month', '2026-10-01', '2026-10-14')).toBe(false);
    expect(canGoForward('year', '2026-03-01', '2026-10-14')).toBe(false);
  });
});

describe('isCostLine', () => {
  const line = (key: string): StatementLine => ({ key, label: key, level: 'item', amount: '0', previous: '0' });

  it('treats costs and returns as cost lines', () => {
    expect(['cogs', 'returns', 'rent', 'operating'].map((key) => isCostLine(line(key)))).toEqual([true, true, true, true]);
    expect(['sales', 'revenue', 'gross_margin', 'net_profit'].map((key) => isCostLine(line(key)))).toEqual([false, false, false, false]);
  });
});

describe('calendarCells', () => {
  it('starts on Monday and fills whole weeks', () => {
    const cells = calendarCells('2026-09-01', [{ date: '2026-09-05', net_profit: '120.00' }]);

    expect(cells.length % 7).toBe(0);
    expect(cells.slice(0, 2).map((c) => c.day)).toEqual([null, 1]);
    expect(cells.find((c) => c.date === '2026-09-05')?.value).toBe(120);
    expect(cells.find((c) => c.date === '2026-09-30')?.value).toBeNull();
  });
});

describe('dayTone', () => {
  it('uses blue for profit, red for loss and grey for zero', () => {
    expect(dayTone(900, 1000, 500).background).toBe('#2a78d6');
    expect(dayTone(100, 1000, 500).background).toBe('#cfe0f6');
    expect(dayTone(-400, 1000, 500).background).toBe('#b91c1c');
    expect(dayTone(0.2, 1000, 500).background).toBe('#ebe7e7');
    expect(dayTone(null, 1000, 500).background).toBe('transparent');
  });
});

describe('compactMoney', () => {
  it.each([
    [1250, '+1,3k'],
    [-10_914, '−10,9k'],
    [812, '+812'],
    [0.3, '0'],
  ])('formats %d', (value, expected) => {
    expect(compactMoney(value)).toBe(expected);
  });
});