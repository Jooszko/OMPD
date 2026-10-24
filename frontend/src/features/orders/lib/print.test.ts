import { describe, expect, it } from 'vitest';
import type { OrderDayItem, OrderDayRoute, OrderDayStop } from '../../../services/api';
import { printRouteParam, routeLoad, stopsInDrivingOrder } from './print';

function item(productId: number, name: string, qty: number, status: OrderDayItem['status'] = 'planned'): OrderDayItem {
  return { product_id: productId, product_name: name, qty, price: 1, status };
}

function stop(clientId: number, items: OrderDayItem[]): OrderDayStop {
  return {
    id: `2026-10-25-${clientId}`,
    client_id: clientId,
    client_name: `Klient ${clientId}`,
    address: 'Rynek 1',
    phone: '',
    is_standing: false,
    status: 'planned',
    locked: false,
    total_quantity: 0,
    total_amount: 0,
    items,
  };
}

const route: OrderDayRoute = {
  route_id: 1,
  route_name: 'Trasa 1',
  driver_name: null,
  total_quantity: 0,
  total_amount: 0,
  driving_order: [3, 1],
  stops: [
    stop(1, [item(10, 'Chleb', 5), item(20, 'Bułka', 40)]),
    stop(2, [item(20, 'Bułka', 10, 'cancelled')]),
    stop(3, [item(20, 'Bułka', 30)]),
  ],
};

describe('print helpers', () => {
  it('follows the driving order and keeps unlisted stops at the end', () => {
    expect(stopsInDrivingOrder(route).map((s) => s.client_id)).toEqual([3, 1, 2]);
  });

  it('sums what to load without cancelled lines', () => {
    expect(routeLoad(route)).toEqual([
      { product_id: 20, product_name: 'Bułka', quantity: 70 },
      { product_id: 10, product_name: 'Chleb', quantity: 5 },
    ]);
  });

  it('names the route in the address', () => {
    expect([printRouteParam(4), printRouteParam(null)]).toEqual(['4', 'none']);
  });
});