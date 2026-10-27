import { describe, expect, it } from 'vitest';
import type { StandingOrderGroup } from '../../../services/api';
import {
  basketsFromStanding,
  copyBasket,
  dayLoad,
  fillMissingBaskets,
  groupStandingByRoute,
  matchesStanding,
  scheduleFromBaskets,
  standingFormError,
  toggleDay,
  weeklyTotals,
} from './standing';

const bread = { product_id: 1, product_name: 'Chleb', price: 2, qty: 10 };
const bun = { product_id: 2, product_name: 'Drożdżówka', price: 1, qty: 30 };

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
    schedule: days.map((day) => ({
      day,
      items: [{ ...bread, qty: quantity }],
      total_quantity: quantity,
      total_amount: quantity * 2,
    })),
    same_every_day: true,
    weekly_quantity: quantity * days.length,
    weekly_amount: quantity * 2 * days.length,
  };
}

describe('standing helpers', () => {
  it('toggles days and keeps them sorted', () => {
    expect(toggleDay([4, 0], 2)).toEqual([0, 2, 4]);
    expect(toggleDay([0, 2, 4], 2)).toEqual([0, 4]);
  });

  it('takes weekly totals from the backend', () => {
    expect(weeklyTotals(order('Sklep', 1, [0, 1, 2, 3, 4, 5]))).toEqual({ pieces: 60, value: 120 });
  });

  it('adds up pieces for every weekday from each day basket', () => {
    const hotel = order('Hotel', 1, [1, 6], 5);
    hotel.schedule[1] = { day: 6, items: [bun], total_quantity: 30, total_amount: 30 };

    expect(dayLoad([order('Sklep', 1, [0, 1], 10), hotel])).toEqual([10, 15, 0, 0, 0, 0, 30]);
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
});

describe('day baskets', () => {
  it('reads one basket per day', () => {
    const shop = order('Sklep', 1, [0, 4]);
    shop.schedule[1] = { day: 4, items: [bun], total_quantity: 30, total_amount: 30 };

    expect(basketsFromStanding(shop)).toEqual({ 0: [{ ...bread }], 4: [{ ...bun }] });
  });

  it('copies a basket to other days without sharing the objects', () => {
    const baskets = copyBasket({ 0: [bread], 4: [bun] }, 0, [2, 4]);

    expect(baskets).toEqual({ 0: [bread], 2: [bread], 4: [bread] });
    expect(baskets[2][0]).not.toBe(bread);
  });

  it('fills only the days that have no basket yet', () => {
    expect(fillMissingBaskets({ 0: [bread], 4: [bun] }, 0, [0, 3, 4])).toEqual({ 0: [bread], 3: [bread], 4: [bun] });
    expect(fillMissingBaskets({ 0: [bread] }, null, [3])).toEqual({ 0: [bread] });
  });

  it('builds the schedule only for chosen days and positive quantities', () => {
    const schedule = scheduleFromBaskets([0, 4], { 0: [bread, { ...bun, qty: 0 }], 2: [bun], 4: [bun] });

    expect(schedule).toEqual([
      { day: 0, items: [{ product_id: 1, qty: 10 }] },
      { day: 4, items: [{ product_id: 2, qty: 30 }] },
    ]);
  });

  it('needs a client, a day and products on every chosen day', () => {
    expect(standingFormError(null, [0], {})).toBe('Wybierz klienta.');
    expect(standingFormError(1, [], {})).toMatch(/dzień/);
    expect(standingFormError(1, [0, 2], { 0: [bread], 2: [{ ...bun, qty: 0 }] })).toBe('Dodaj produkty na: Śr.');
    expect(standingFormError(1, [0, 2], { 0: [bread], 2: [bun] })).toBeNull();
  });
});
