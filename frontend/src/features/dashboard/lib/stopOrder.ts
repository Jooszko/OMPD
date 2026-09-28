import type { LogisticsStop, RouteDirections } from '../../../services/api';

export interface SequencedStop {
  stop: LogisticsStop;
  sequence: number | null;
}

export function orderStopsByRoute(
  stops: LogisticsStop[],
  directions: RouteDirections | null
): SequencedStop[] {
  const positionById = new Map<number, number>();
  directions?.ordered_stops.forEach((s, index) => positionById.set(s.client_id, index));

  const group = (stop: LogisticsStop) => {
    if (positionById.has(stop.client_id)) return 0;
    return stop.orders.length > 0 ? 1 : 2;
  };

  const sorted = [...stops].sort((a, b) => {
    const byGroup = group(a) - group(b);
    if (byGroup !== 0) return byGroup;
    if (group(a) === 0) return positionById.get(a.client_id)! - positionById.get(b.client_id)!;
    return 0;
  });

  return sorted.map((stop) => {
    const position = positionById.get(stop.client_id);
    return { stop, sequence: position !== undefined ? position + 1 : null };
  });
}
