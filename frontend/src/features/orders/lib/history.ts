import type { OrderHistoryStop } from '../../../services/api';
import { shiftIsoDate } from './orders';

export type HistoryStatus = 'all' | 'delivered' | 'failed' | 'cancelled' | 'open';

export interface HistoryFilters {
  date_from: string;
  date_to: string;
  status: HistoryStatus;
  page: number;
}

export const HISTORY_STATUSES: { value: HistoryStatus; label: string }[] = [
  { value: 'all', label: 'Wszystkie' },
  { value: 'delivered', label: 'Dostarczone' },
  { value: 'failed', label: 'Nieudane' },
  { value: 'cancelled', label: 'Anulowane' },
  { value: 'open', label: 'Niezamknięte' },
];

type Range = Pick<HistoryFilters, 'date_from' | 'date_to'>;

function monthStart(iso: string, monthsBack: number): string {
  const [year, month] = iso.split('-').map(Number);
  const date = new Date(year, month - 1 - monthsBack, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

export const HISTORY_PRESETS: { label: string; range: (today: string) => Range }[] = [
  { label: '7 dni', range: (today) => ({ date_from: shiftIsoDate(today, -7), date_to: shiftIsoDate(today, -1) }) },
  { label: '30 dni', range: (today) => ({ date_from: shiftIsoDate(today, -30), date_to: shiftIsoDate(today, -1) }) },
  { label: 'Ten miesiąc', range: (today) => ({ date_from: monthStart(today, 0), date_to: shiftIsoDate(today, -1) }) },
  {
    label: 'Poprzedni miesiąc',
    range: (today) => ({ date_from: monthStart(today, 1), date_to: shiftIsoDate(monthStart(today, 0), -1) }),
  },
];

export function groupByDate(stops: OrderHistoryStop[]): { date: string; stops: OrderHistoryStop[] }[] {
  const groups: { date: string; stops: OrderHistoryStop[] }[] = [];
  stops.forEach((stop) => {
    const last = groups[groups.length - 1];
    if (last?.date === stop.date) last.stops.push(stop);
    else groups.push({ date: stop.date, stops: [stop] });
  });
  return groups;
}