import { describe, expect, it } from 'vitest';
import { formatDayLabel, formatTime, shiftIsoDate, toIsoDate } from './dateFormat';

describe('toIsoDate', () => {
  it('pads month and day with zeros', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('shiftIsoDate', () => {
  it.each([
    ['2026-10-04', -1, '2026-10-03'],
    ['2026-10-01', -1, '2026-09-30'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2026-10-25', 1, '2026-10-26'],
  ])('shifts %s by %i day(s) to %s', (from, days, expected) => {
    expect(shiftIsoDate(from, days)).toBe(expected);
  });
});

describe('formatTime', () => {
  it('formats hours and minutes with leading zeros', () => {
    expect(formatTime(new Date(2026, 9, 4, 7, 5))).toBe('07:05');
  });
});

describe('formatDayLabel', () => {
  it('formats the weekday, day and month in Polish', () => {
    expect(formatDayLabel('2026-10-04')).toBe('niedziela, 4 października');
  });
});