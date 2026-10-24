import { describe, expect, it } from 'vitest';
import type { StandingOrderGroup } from '../../../services/api';
import {
  dayLoad,
  groupStandingByRoute,
  matchesStanding,
  standingFormError,
  toggleDay,
  weeklyTotals,
} from './standing';

function order(name: string, routeId: number, days: number[], quantity = 10): StandingOrderGroup {
  return {
    id: name.length,
    client_id: name.length,
    client_name: name,
    address: 'Rynek 1, Ustroń',
    client_active: true,
    route_id: routeId,
    route_name: `Trasa ${routeId}`,
    driver_name: null,
    days_ids: days,
    day_of_week: '',
    items: [{ product_id: 1, product_name: 'Chleb', qty: quantity, price: 2 }],
    total_quantity: quantity,
    total_amount: quantity * 2,
  };
}

describe('standing helpers', () => {
  it('toggles days and keeps them sorted', () => {
    expect(toggleDay([4, 0], 2)).toEqual([0, 2, 4]);
    expect(toggleDay([0, 2, 4], 2)).toEqual([0, 4]);
  });

  it('multiplies one delivery by the number of days', () => {
    expect(weeklyTotals(order('Sklep', 1, [0, 1, 2, 3, 4, 5]))).toEqual({ pieces: 60, value: 120 });
  });

  it('adds up pieces for every weekday', () => {
    expect(dayLoad([order('Sklep', 1, [0, 1], 10), order('Hotel', 1, [1, 6], 5)])).toEqual([10, 15, 0, 0, 0, 0, 5]);
  });

  it('groups by route in natural order', () => {
    const groups = groupStandingByRoute([order('A', 10, [0]), order('B', 2, [0]), order('C', 2, [1])]);

    expect(groups.map((group) => [group.routeName, group.orders.length])).toEqual([
      ['Trasa 2', 2],
      ['Trasa 10', 1],
    ]);
  });

  it('searches name and address without Polish letters', () => {
    expect(matchesStanding(order('Sklep', 1, [0]), 'ustron')).toBe(true);
    expect(matchesStanding(order('Sklep', 1, [0]), 'wisla')).toBe(false);
  });

  it('needs a client, a day and a product', () => {
    expect(standingFormError(null, [0], [])).toBe('Wybierz klienta.');
    expect(standingFormError(1, [], [])).toMatch(/dzień/);
    expect(standingFormError(1, [0], [{ product_id: 1, product_name: 'Chleb', price: 2, qty: 0 }])).toMatch(/produkt/);
    expect(standingFormError(1, [0], [{ product_id: 1, product_name: 'Chleb', price: 2, qty: 5 }])).toBeNull();
  });
});