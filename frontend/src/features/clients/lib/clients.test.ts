import { describe, expect, it } from 'vitest';
import type { AppClient } from '../../../services/api';
import {
  clientCounts,
  deliveryTone,
  formatDays,
  formatDeliveryDate,
  formatNip,
  formatPhone,
  groupByRoute,
  isLocated,
  isValidNip,
  matchesClientFilter,
  matchesClientQuery,
  weekStrip,
} from './clients';

function client(name: string, fields: Partial<AppClient> = {}): AppClient {
  return {
    client_id: name.length,
    name,
    address: 'Leśna 22, Brenna',
    nip: null,
    phone: '+48600103551',
    route: 4,
    route_details: { route_id: 4, route_name: 'Trasa 4', is_active: true, driver_name: 'Michał Wójcik' },
    is_active: true,
    latitude: '49.727500',
    longitude: '18.903100',
    geocoded_at: '2026-10-18T08:00:00Z',
    standing_days: [0, 6],
    ...fields,
  };
}

describe('matchesClientQuery', () => {
  const cafe = client('Kawiarnia „Nad Wisłą”', { nip: '5260250995' });

  it.each(['', 'wisla', 'NAD WIS', 'lesna 22', 'brenna', '600 103', '103551', '526-025'])('finds "%s"', (query) => {
    expect(matchesClientQuery(cafe, query)).toBe(true);
  });

  it('ignores too short numbers and other names', () => {
    expect(matchesClientQuery(cafe, '12')).toBe(false);
    expect(matchesClientQuery(cafe, 'piekarnia')).toBe(false);
  });
});

describe('filters and counts', () => {
  const clients = [
    client('A'),
    client('B', { is_active: false }),
    client('C', { latitude: null, longitude: null }),
    client('D', { is_active: false, latitude: null, longitude: null }),
  ];

  it('treats a client without coordinates as not located', () => {
    expect(isLocated(clients[2])).toBe(false);
    expect(isLocated(clients[0])).toBe(true);
  });

  it('counts active, inactive and unlocated clients', () => {
    expect(clientCounts(clients)).toEqual({ all: 4, active: 2, inactive: 2, unlocated: 2 });
  });

  it('filters by state', () => {
    expect(clients.filter((c) => matchesClientFilter(c, 'inactive')).map((c) => c.name)).toEqual(['B', 'D']);
    expect(clients.filter((c) => matchesClientFilter(c, 'unlocated')).map((c) => c.name)).toEqual(['C', 'D']);
    expect(clients.filter((c) => matchesClientFilter(c, 'all'))).toHaveLength(4);
  });
});

describe('groupByRoute', () => {
  const route = (id: number, driver: string | null) => ({
    route: id,
    route_details: { route_id: id, route_name: `Trasa ${id}`, is_active: true, driver_name: driver },
  });

  it('groups clients by route in natural order and keeps the driver', () => {
    const groups = groupByRoute([client('X', route(10, null)), client('Y', route(2, 'Jan Nowak')), client('Z', route(2, 'Jan Nowak'))]);

    expect(groups.map((g) => [g.name, g.driver, g.clients.length])).toEqual([
      ['Trasa 2', 'Jan Nowak', 2],
      ['Trasa 10', null, 1],
    ]);
  });
});

describe('week', () => {
  it('marks the standing order days', () => {
    expect(weekStrip([0, 6]).map((d) => (d.active ? d.label : '-')).join(' ')).toBe('Pn - - - - - Nd');
    expect(weekStrip([2])[2]).toEqual({ label: 'Śr', letter: 'Ś', active: true });
  });

  it('describes the days in words', () => {
    expect(formatDays([0, 6])).toBe('Pn, Nd');
    expect(formatDays([])).toBe('brak stałych zamówień');
  });
});

describe('formatting', () => {
  it.each([
    ['+48600103551', '+48 600 103 551'],
    ['600103551', '600 103 551'],
    ['+4960010355199', '+4960010355199'],
  ])('phone %s → %s', (phone, expected) => {
    expect(formatPhone(phone)).toBe(expected);
  });

  it('groups NIP digits', () => {
    expect(formatNip('5260250995')).toBe('526-025-09-95');
    expect(formatNip('123')).toBe('123');
  });

  it('formats delivery dates with the weekday', () => {
    expect(formatDeliveryDate('2026-10-18')).toBe('niedz., 18 paź');
  });
});

describe('isValidNip', () => {
  it.each([
    ['5260250995', true],
    ['526-025-09-95', true],
    ['5260250994', false],
    ['123', false],
  ])('%s → %s', (nip, valid) => {
    expect(isValidNip(nip)).toBe(valid);
  });
});

describe('deliveryTone', () => {
  it.each([
    ['delivered', 'success'],
    ['failed', 'danger'],
    ['cancelled', 'muted'],
    ['planned', 'info'],
    ['in_delivery', 'info'],
  ] as const)('%s → %s', (status, tone) => {
    expect(deliveryTone(status)).toBe(tone);
  });
});