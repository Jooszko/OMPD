import { describe, expect, it } from 'vitest';
import { makeDirections, makeOrder, makeStop } from '../../../test/factories';
import { getStopSequences, orderStopsByRoute } from './stopOrder';

describe('getStopSequences', () => {
  it('returns an empty map without directions', () => {
    expect(getStopSequences(null).size).toBe(0);
  });

  it('numbers stops from 1 in route order', () => {
    const sequences = getStopSequences(makeDirections([7, 3, 12]));
    expect([...sequences.entries()]).toEqual([
      [7, 1],
      [3, 2],
      [12, 3],
    ]);
  });
});

describe('orderStopsByRoute', () => {
  it('puts routed stops first, then unrouted deliveries, then stops without orders', () => {
    const noDelivery = makeStop({ client_id: 1 });
    const unrouted = makeStop({ client_id: 2, orders: [makeOrder()] });
    const second = makeStop({ client_id: 3, orders: [makeOrder()] });
    const first = makeStop({ client_id: 4, orders: [makeOrder()] });

    const result = orderStopsByRoute([noDelivery, unrouted, second, first], makeDirections([4, 3]));

    expect(result.map((r) => r.stop.client_id)).toEqual([4, 3, 2, 1]);
    expect(result.map((r) => r.sequence)).toEqual([1, 2, null, null]);
  });

  it('keeps the original order within a group when there are no directions', () => {
    const stops = [makeStop({ client_id: 9, orders: [makeOrder()] }), makeStop({ client_id: 5, orders: [makeOrder()] })];

    const result = orderStopsByRoute(stops, null);

    expect(result.map((r) => r.stop.client_id)).toEqual([9, 5]);
    expect(result.every((r) => r.sequence === null)).toBe(true);
  });

  it('does not modify the input array', () => {
    const stops = [makeStop({ client_id: 1 }), makeStop({ client_id: 2, orders: [makeOrder()] })];
    const copy = [...stops];

    orderStopsByRoute(stops, makeDirections([2]));

    expect(stops).toEqual(copy);
  });
});