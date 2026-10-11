import { describe, expect, it } from 'vitest';
import type { AuditEntry } from '../../../services/api';
import { formatAuditValue, formatEntryCount, groupEntriesByDay } from './auditFormat';

function entry(entryId: number, createdAt: string): AuditEntry {
  return {
    entry_id: entryId,
    created_at: createdAt,
    actor: null,
    actor_name: 'Anna Admin',
    category: 'clients',
    category_label: 'Klienci',
    action: 'client.updated',
    action_label: 'Zmiana danych klienta',
    object_type: 'client',
    object_id: '1',
    object_label: 'Sklep Pod Lipą',
    description: 'Zmieniono dane klienta.',
    changes: [],
    ip_address: null,
  };
}

describe('formatAuditValue', () => {
  it.each([
    [null, '—'],
    [undefined, '—'],
    ['', '—'],
    [true, 'Tak'],
    [false, 'Nie'],
    ['12.50', '12.50'],
    [3, '3'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatAuditValue(value)).toBe(expected);
  });
});

describe('formatEntryCount', () => {
  it.each([
    [0, '0 wpisów'],
    [1, '1 wpis'],
    [2, '2 wpisy'],
    [4, '4 wpisy'],
    [5, '5 wpisów'],
    [12, '12 wpisów'],
    [22, '22 wpisy'],
  ])('uses the right form for %i', (count, expected) => {
    expect(formatEntryCount(count)).toBe(expected);
  });
});

describe('groupEntriesByDay', () => {
  it('groups consecutive entries by local day with friendly labels', () => {
    const groups = groupEntriesByDay(
      [
        entry(4, '2026-10-11T15:00:00'),
        entry(3, '2026-10-11T09:00:00'),
        entry(2, '2026-10-10T18:00:00'),
        entry(1, '2026-10-07T12:00:00'),
      ],
      '2026-10-11'
    );

    expect(groups.map((g) => [g.day, g.entries.map((e) => e.entry_id)])).toEqual([
      ['2026-10-11', [4, 3]],
      ['2026-10-10', [2]],
      ['2026-10-07', [1]],
    ]);
    expect(groups.map((g) => g.label)).toEqual(['Dziś', 'Wczoraj', 'środa, 7 października']);
  });
});