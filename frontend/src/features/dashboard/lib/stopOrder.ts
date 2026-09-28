import type { LogisticsStop, RouteDirections } from '../../../services/api';

export interface SequencedStop {
  stop: LogisticsStop;
  sequence: number | null;
}

export function getStopSequences(directions?: RouteDirections | null): Map<number, number> {
  const sequenceById = new Map<number, number>();
  directions?.ordered_stops.forEach((s, index) => sequenceById.set(s.client_id, index + 1));
  return sequenceById;
}

export function orderStopsByRoute(
  stops: LogisticsStop[],
  directions: RouteDirections | null
): SequencedStop[] {
  const sequenceById = getStopSequences(directions);

  const group = (stop: LogisticsStop) => {
    if (sequenceById.has(stop.client_id)) return 0;
    return stop.orders.length > 0 ? 1 : 2;
  };

  const sorted = [...stops].sort((a, b) => {
    const byGroup = group(a) - group(b);
    if (byGroup !== 0) return byGroup;
    if (group(a) === 0) return sequenceById.get(a.client_id)! - sequenceById.get(b.client_id)!;
    return 0;
  });

  return sorted.map((stop) => ({ stop, sequence: sequenceById.get(stop.client_id) ?? null }));
}