import { describe, expect, it } from 'vitest';
import { makeOrder, makeStop } from '../../../test/factories';
import { getRouteProgress, getStopDeliveredAt, getStopState } from './routeProgress';

describe('getStopState', () => {
  it('returns "none" for a stop without orders', () => {
    expect(getStopState(makeStop())).toBe('none');
  });

  it.each(['planned', 'in_production', 'in_delivery'] as const)(
    'returns "pending" while an order is %s',
    (status) => {
      const stop = makeStop({ orders: [makeOrder({ status: 'delivered' }), makeOrder({ status })] });
      expect(getStopState(stop)).toBe('pending');
    }
  );

  it('returns "delivered" when every order is delivered', () => {
    const stop = makeStop({ orders: [makeOrder({ status: 'delivered' }), makeOrder({ status: 'delivered' })] });
    expect(getStopState(stop)).toBe('delivered');
  });

  it('returns "failed" when all orders are handled and at least one failed', () => {
    const stop = makeStop({ orders: [makeOrder({ status: 'delivered' }), makeOrder({ status: 'failed' })] });
    expect(getStopState(stop)).toBe('failed');
  });
});

describe('getRouteProgress', () => {
  it('counts handled stops and ignores stops without orders', () => {
    const stops = [
      makeStop(),
      makeStop({ orders: [makeOrder({ status: 'delivered' })] }),
      makeStop({ orders: [makeOrder({ status: 'failed' })] }),
      makeStop({ orders: [makeOrder({ status: 'in_delivery' })] }),
    ];
    expect(getRouteProgress(stops)).toEqual({ done: 2, failed: 1, total: 3 });
  });

  it('returns zeros for a route without deliveries', () => {
    expect(getRouteProgress([makeStop(), makeStop()])).toEqual({ done: 0, failed: 0, total: 0 });
  });
});

describe('getStopDeliveredAt', () => {
  it('returns the latest delivery time of the stop', () => {
    const stop = makeStop({
      orders: [
        makeOrder({ status: 'delivered', delivered_at: '2026-10-04T09:40:00Z' }),
        makeOrder({ status: 'delivered', delivered_at: '2026-10-04T08:15:00Z' }),
      ],
    });
    expect(getStopDeliveredAt(stop)).toBe('2026-10-04T09:40:00Z');
  });

  it('ignores orders without a delivery time', () => {
    const stop = makeStop({
      orders: [makeOrder({ delivered_at: null }), makeOrder({ status: 'delivered', delivered_at: '2026-10-04T08:15:00Z' })],
    });
    expect(getStopDeliveredAt(stop)).toBe('2026-10-04T08:15:00Z');
  });

  it('returns null when nothing was delivered', () => {
    expect(getStopDeliveredAt(makeStop({ orders: [makeOrder()] }))).toBeNull();
  });
});
