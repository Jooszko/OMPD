import type { LogisticsOrder, LogisticsStop, OrderedStop, RouteDirections } from '../services/api';

let nextId = 1;

export function makeOrder(overrides: Partial<LogisticsOrder> = {}): LogisticsOrder {
  return {
    do_id: nextId++,
    product_name: 'Chleb',
    quantity: 1,
    status: 'in_delivery',
    delivered_at: null,
    failure_reason: '',
    failure_note: '',
    failed_at: null,
    ...overrides,
  };
}

export function makeStop(overrides: Partial<LogisticsStop> = {}): LogisticsStop {
  const clientId = overrides.client_id ?? nextId++;
  return {
    client_id: clientId,
    name: `Klient ${clientId}`,
    address: `Ulica ${clientId}, Skoczów`,
    phone: '',
    latitude: '49.800000',
    longitude: '18.780000',
    orders: [],
    ...overrides,
  };
}

export function makeOrderedStop(clientId: number): OrderedStop {
  return { client_id: clientId, name: `Klient ${clientId}`, latitude: '49.800000', longitude: '18.780000' };
}

export function makeDirections(orderedClientIds: number[]): RouteDirections {
  return {
    geometry: null,
    distance_m: null,
    duration_s: null,
    provider: null,
    skipped_stops: [],
    note: null,
    optimized: true,
    ordered_stops: orderedClientIds.map(makeOrderedStop),
  };
}