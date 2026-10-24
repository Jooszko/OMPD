import { describe, expect, it } from 'vitest';
import type { OrderHistoryStop } from '../../../services/api';
import { HISTORY_PRESETS, groupByDate } from './history';

describe('history presets', () => {
  it('end yesterday and cover whole months', () => {
    expect(HISTORY_PRESETS.map((preset) => preset.range('2026-03-05'))).toEqual([
      { date_from: '2026-02-26', date_to: '2026-03-04' },
      { date_from: '2026-02-03', date_to: '2026-03-04' },
      { date_from: '2026-03-01', date_to: '2026-03-04' },
      { date_from: '2026-02-01', date_to: '2026-02-28' },
    ]);
  });

  it('cross the year boundary', () => {
    expect(HISTORY_PRESETS[3].range('2027-01-10')).toEqual({ date_from: '2026-12-01', date_to: '2026-12-31' });
  });
});

describe('groupByDate', () => {
  it('keeps the server order and starts a group at each new date', () => {
    const stop = (id: string, date: string) => ({ id, date }) as OrderHistoryStop;

    const groups = groupByDate([stop('a', '2026-03-04'), stop('b', '2026-03-04'), stop('c', '2026-03-03')]);

    expect(groups.map((group) => [group.date, group.stops.map((s) => s.id)])).toEqual([
      ['2026-03-04', ['a', 'b']],
      ['2026-03-03', ['c']],
    ]);
  });
});