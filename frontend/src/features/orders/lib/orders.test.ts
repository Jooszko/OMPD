import { describe, expect, it } from 'vitest';
import type { OrderDayRoute, OrderDayStop, OrderStatus } from '../../../services/api';
import {
  daysBetween,
  filterRoutes,
  formatDayHeading,
  isIsoDate,
  normalizeText,
  plural,
  relativeDayLabel,
  shiftIsoDate,
  statusSegments,
  toIsoDate,
} from './orders';

function stop(name: string, status: OrderStatus = 'planned', address = 'Rynek 1, Skoczów'): OrderDayStop {
  return {
    id: `2026-10-25-${name}`,
    client_id: name.length,
    client_name: name,
    address,
    phone: '',
    is_standing: true,
    status,
    locked: false,
    total_quantity: 10,
    total_amount: 20,
    items: [],
  };
}

function route(name: string, stops: OrderDayStop[]): OrderDayRoute {
  return {
    route_id: name.length,
    route_name: name,
    driver_name: null,
    total_quantity: 0,
    total_amount: 0,
    driving_order: [],
    stops,
  };
}

describe('dates', () => {
  it('uses the local calendar day, not UTC', () => {
    expect(toIsoDate(new Date(2026, 9, 25, 0, 30))).toBe('2026-10-25');
  });

  it('shifts across months and the DST change', () => {
    expect(shiftIsoDate('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftIsoDate('2026-10-25', -1)).toBe('2026-10-24');
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('names yesterday, today and tomorrow', () => {
    expect(relativeDayLabel('2026-10-24', '2026-10-24')).toBe('Dziś');
    expect(relativeDayLabel('2026-10-25', '2026-10-24')).toBe('Jutro');
    expect(relativeDayLabel('2026-10-23', '2026-10-24')).toBe('Wczoraj');
    expect(relativeDayLabel('2026-10-30', '2026-10-24')).toBeNull();
  });

  it('formats the heading in Polish', () => {
    expect(formatDayHeading('2026-10-25')).toBe('niedziela, 25 października');
  });

  it('accepts only real ISO dates from the URL', () => {
    expect(isIsoDate('2026-10-25')).toBe(true);
    expect(isIsoDate('25.10.2026')).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });
});

describe('filtering', () => {
  const routes = [
    route('Trasa 1', [stop('Sklep Spożywczy "Złoty Kłos"'), stop('Hotel "Zielona"', 'delivered')]),
    route('Trasa 2', [stop('Kawiarnia "Mała"', 'planned', 'Rynek 3, Ustroń')]),
  ];

  it('ignores case and Polish letters', () => {
    expect(normalizeText('Złoty KŁOS')).toBe('zloty klos');
    expect(filterRoutes(routes, 'zloty klos', 'all').map((r) => r.stops.length)).toEqual([1]);
  });

  it('searches the address too and drops empty routes', () => {
    expect(filterRoutes(routes, 'ustron', 'all').map((r) => r.route_name)).toEqual(['Trasa 2']);
  });

  it('filters by stop status', () => {
    expect(filterRoutes(routes, '', 'delivered').flatMap((r) => r.stops.map((s) => s.client_name))).toEqual([
      'Hotel "Zielona"',
    ]);
  });
});

describe('statusSegments', () => {
  it('keeps the flow order and skips empty statuses', () => {
    const byStatus = { planned: 2, in_production: 0, in_delivery: 1, delivered: 1, failed: 0, cancelled: 0 };

    expect(statusSegments(byStatus)).toEqual([
      { status: 'planned', count: 2, share: 0.5 },
      { status: 'in_delivery', count: 1, share: 0.25 },
      { status: 'delivered', count: 1, share: 0.25 },
    ]);
  });
});

describe('plural', () => {
  it('picks the Polish form', () => {
    expect([1, 2, 5, 22].map((n) => plural(n, 'pozycja', 'pozycje', 'pozycji'))).toEqual([
      'pozycja',
      'pozycje',
      'pozycji',
      'pozycje',
    ]);
  });
});