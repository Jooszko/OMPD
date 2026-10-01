import type { LogisticsOrder, LogisticsStop } from '../../../services/api';

export type StopState = 'none' | 'pending' | 'delivered' | 'failed';

const HANDLED_STATUSES = new Set<LogisticsOrder['status']>(['delivered', 'failed']);

export function getStopState(stop: LogisticsStop): StopState {
  if (stop.orders.length === 0) return 'none';
  if (!stop.orders.every((o) => HANDLED_STATUSES.has(o.status))) return 'pending';
  return stop.orders.some((o) => o.status === 'failed') ? 'failed' : 'delivered';
}

export function isStopDelivered(stop: LogisticsStop): boolean {
  return getStopState(stop) === 'delivered';
}

export function getRouteProgress(stops: LogisticsStop[]): { done: number; failed: number; total: number } {
  const states = stops.map(getStopState).filter((s) => s !== 'none');
  return {
    done: states.filter((s) => s !== 'pending').length,
    failed: states.filter((s) => s === 'failed').length,
    total: states.length,
  };
}

export function getStopDeliveredAt(stop: LogisticsStop): string | null {
  const times = stop.orders.map((o) => o.delivered_at).filter((t): t is string => t !== null);
  if (times.length === 0) return null;
  return times.reduce((latest, t) => (new Date(t) > new Date(latest) ? t : latest));
}
