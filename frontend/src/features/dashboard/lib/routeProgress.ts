import type { LogisticsStop } from '../../../services/api';

export function isStopDelivered(stop: LogisticsStop): boolean {
  return stop.orders.length > 0 && stop.orders.every((o) => o.status === 'delivered');
}

export function getRouteProgress(stops: LogisticsStop[]): { done: number; total: number } {
  const withDelivery = stops.filter((s) => s.orders.length > 0);
  return {
    done: withDelivery.filter(isStopDelivered).length,
    total: withDelivery.length,
  };
}