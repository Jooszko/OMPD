import type { StandingOrderGroup } from '../../../services/api';
import type { FormItem } from './orderForm';
import { normalizeText } from './orders';

export const WEEKDAY_LABELS = ['Pn', 'Wt', 'Śr', 'Czw', 'Pt', 'Sb', 'Nd'];

export const DAY_PRESETS: { label: string; days: number[] }[] = [
  { label: 'Pn–Pt', days: [0, 1, 2, 3, 4] },
  { label: 'Pn–Sb', days: [0, 1, 2, 3, 4, 5] },
  { label: 'Codziennie', days: [0, 1, 2, 3, 4, 5, 6] },
];

export type DayBaskets = Record<number, FormItem[]>;

export interface StandingRouteGroup {
  routeId: number;
  routeName: string;
  driverName: string | null;
  orders: StandingOrderGroup[];
}

export function toggleDay(days: number[], day: number): number[] {
  return days.includes(day) ? days.filter((value) => value !== day) : [...days, day].sort((a, b) => a - b);
}

export function weeklyTotals(order: Pick<StandingOrderGroup, 'weekly_quantity' | 'weekly_amount'>) {
  return { pieces: order.weekly_quantity, value: order.weekly_amount };
}

export function dayLoad(orders: StandingOrderGroup[]): number[] {
  const load = [0, 0, 0, 0, 0, 0, 0];
  orders.forEach((order) => order.schedule.forEach((entry) => (load[entry.day] += entry.total_quantity)));
  return load;
}

export function matchesStanding(order: StandingOrderGroup, query: string): boolean {
  const needle = normalizeText(query.trim());
  return !needle || normalizeText(`${order.client_name} ${order.address}`).includes(needle);
}

export function groupStandingByRoute(orders: StandingOrderGroup[]): StandingRouteGroup[] {
  const groups = new Map<number, StandingRouteGroup>();
  orders.forEach((order) => {
    const group = groups.get(order.route_id) ?? {
      routeId: order.route_id,
      routeName: order.route_name,
      driverName: order.driver_name,
      orders: [],
    };
    group.orders.push(order);
    groups.set(order.route_id, group);
  });
  return [...groups.values()].sort((a, b) => a.routeName.localeCompare(b.routeName, 'pl', { numeric: true }));
}

export function basketsFromStanding(order: StandingOrderGroup): DayBaskets {
  return Object.fromEntries(
    order.schedule.map((entry) => [
      entry.day,
      entry.items.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        price: item.price,
        qty: item.qty,
      })),
    ])
  );
}

export function copyBasket(baskets: DayBaskets, from: number, days: number[]): DayBaskets {
  const source = baskets[from] ?? [];
  return { ...baskets, ...Object.fromEntries(days.map((day) => [day, source.map((item) => ({ ...item }))])) };
}

export function fillMissingBaskets(baskets: DayBaskets, from: number | null, days: number[]): DayBaskets {
  const missing = days.filter((day) => !baskets[day]);
  return from === null || missing.length === 0 ? baskets : copyBasket(baskets, from, missing);
}

export function scheduleFromBaskets(days: number[], baskets: DayBaskets) {
  return days.map((day) => ({
    day,
    items: (baskets[day] ?? [])
      .filter((item) => item.qty > 0)
      .map((item) => ({ product_id: item.product_id, qty: item.qty })),
  }));
}

export function standingFormError(clientId: number | null, days: number[], baskets: DayBaskets): string | null {
  if (clientId === null) return 'Wybierz klienta.';
  if (days.length === 0) return 'Zaznacz przynajmniej jeden dzień dostaw.';
  const empty = days.filter((day) => !(baskets[day] ?? []).some((item) => item.qty > 0));
  if (empty.length > 0) return `Dodaj produkty na: ${empty.map((day) => WEEKDAY_LABELS[day]).join(', ')}.`;
  return null;
}