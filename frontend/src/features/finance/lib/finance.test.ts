import { describe, expect, it } from 'vitest';
import { changeVsPrevious, formatMoney, formatShare } from './money';
import { comparisonLabel, periodLabel, periodLength, presetPeriod } from './period';

describe('presetPeriod', () => {
  it.each([
    ['7', '2026-10-07', '2026-10-13'],
    ['30', '2026-09-14', '2026-10-13'],
    ['month', '2026-10-01', '2026-10-13'],
  ] as const)('builds the %s preset ending today', (preset, start, end) => {
    expect(presetPeriod(preset, '2026-10-13')).toEqual({ preset, start, end });
  });
});

describe('period labels', () => {
  it('counts days including both ends', () => {
    expect(periodLength('2026-09-14', '2026-10-13')).toBe(30);
  });

  it.each([
    ['2026-09-14', '2026-10-13', '14.09 – 13.10.2026'],
    ['2025-12-20', '2026-01-05', '20.12.2025 – 05.01.2026'],
    ['2026-10-13', '2026-10-13', '13.10.2026'],
  ])('formats %s – %s', (start, end, expected) => {
    expect(periodLabel(start, end)).toBe(expected);
  });

  it('describes the comparison period', () => {
    expect(comparisonLabel('2026-10-07', '2026-10-13')).toBe('vs poprzednie 7 dni');
    expect(comparisonLabel('2026-10-13', '2026-10-13')).toBe('vs poprzedni dzień');
  });
});

describe('formatMoney', () => {
  it.each([
    ['48210.40', {}, '48 210 zł'],
    ['-35.00', {}, '−35 zł'],
    ['205.5', { cents: true }, '205,50 zł'],
    ['812', { sign: true }, '+812 zł'],
    ['0.00', { sign: true }, '0 zł'],
  ] as const)('formats %s', (value, options, expected) => {
    expect(formatMoney(value, options).replace(/\s/g, ' ')).toBe(expected);
  });
});

describe('formatShare', () => {
  it('rounds to whole percent and handles zero', () => {
    expect(formatShare('17940', '48210')).toBe('37%');
    expect(formatShare('10', '0')).toBe('—');
  });
});

describe('changeVsPrevious', () => {
  it('marks income growth as good and cost growth as bad', () => {
    expect(changeVsPrevious('48210', '45400', 'income')).toEqual({ label: '▲ 6,2%', tone: 'good' });
    expect(changeVsPrevious('17940', '17400', 'cost')).toEqual({ label: '▲ 3,1%', tone: 'bad' });
    expect(changeVsPrevious('21300', '21690', 'cost')).toEqual({ label: '▼ 1,8%', tone: 'good' });
  });

  it('compares against a negative previous value by its size', () => {
    expect(changeVsPrevious('500', '-1000', 'income')).toEqual({ label: '▲ 150%', tone: 'good' });
  });

  it('handles missing or equal previous values', () => {
    expect(changeVsPrevious('100', '0', 'income')).toEqual({ label: 'brak porównania', tone: 'neutral' });
    expect(changeVsPrevious('0', '0', 'cost')).toEqual({ label: 'bez zmian', tone: 'neutral' });
    expect(changeVsPrevious('100', '100', 'cost')).toEqual({ label: 'bez zmian', tone: 'neutral' });
  });
});