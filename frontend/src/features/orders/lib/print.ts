import type { OrderDayRoute, OrderDayStop } from '../../../services/api';

export function stopsInDrivingOrder(route: OrderDayRoute): OrderDayStop[] {
  const byClient = new Map(route.stops.map((stop) => [stop.client_id, stop]));
  const ordered = route.driving_order.flatMap((clientId) => byClient.get(clientId) ?? []);
  return [...ordered, ...route.stops.filter((stop) => !route.driving_order.includes(stop.client_id))];
}

export function activeItems(stop: OrderDayStop) {
  return stop.items.filter((item) => item.status !== 'cancelled');
}

export function routeLoad(route: OrderDayRoute): { product_id: number; product_name: string; quantity: number }[] {
  const load = new Map<number, { product_id: number; product_name: string; quantity: number }>();
  route.stops.forEach((stop) =>
    activeItems(stop).forEach((item) => {
      const entry = load.get(item.product_id) ?? { product_id: item.product_id, product_name: item.product_name, quantity: 0 };
      entry.quantity += item.qty;
      load.set(item.product_id, entry);
    })
  );
  return [...load.values()].sort((a, b) => b.quantity - a.quantity || a.product_name.localeCompare(b.product_name, 'pl'));
}

export function printRouteParam(routeId: number | null): string {
  return routeId === null ? 'none' : String(routeId);
}