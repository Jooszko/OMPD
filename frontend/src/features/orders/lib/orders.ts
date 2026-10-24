import type { OrderDayRoute, OrderDayStop, OrderStatus } from '../../../services/api';

export type StatusFilter = 'all' | OrderStatus;

export const STATUS_ORDER: OrderStatus[] = ['planned', 'in_production', 'in_delivery', 'delivered', 'failed', 'cancelled'];

export const STATUS_META: Record<OrderStatus, { label: string; badge: string; dot: string }> = {
  planned: { label: 'Zaplanowane', badge: 'bg-[#e6e1df] text-[#3d3937]', dot: 'bg-[#8a8381]' },
  in_production: { label: 'W produkcji', badge: 'bg-[#fbe5bd] text-[#7a4300]', dot: 'bg-[#e08a00]' },
  in_delivery: { label: 'W dostawie', badge: 'bg-[#dfe8f6] text-[#1d4f91]', dot: 'bg-[#2f6fbf]' },
  delivered: { label: 'Dostarczone', badge: 'bg-[#dcefe0] text-[#1f5f33]', dot: 'bg-[#2e8b4e]' },
  failed: { label: 'Nieudana dostawa', badge: 'bg-[#f8cccc] text-[#8f1616]', dot: 'bg-[#c62828]' },
  cancelled: { label: 'Anulowane', badge: 'bg-[#ece8e6] text-[#6b6563]', dot: 'bg-[#b5aeab]' },
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function isIsoDate(value: string | null): value is string {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function shiftIsoDate(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const [fromYear, fromMonth, fromDay] = fromIso.split('-').map(Number);
  const [toYear, toMonth, toDay] = toIso.split('-').map(Number);
  return Math.round((Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / DAY_MS);
}

export function relativeDayLabel(iso: string, todayIso: string): string | null {
  const labels: Record<number, string> = { [-1]: 'Wczoraj', 0: 'Dziś', 1: 'Jutro' };
  return labels[daysBetween(todayIso, iso)] ?? null;
}

export function formatDayHeading(iso: string): string {
  return new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }).format(parseIsoDate(iso));
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value);
}

export function formatPieces(value: number): string {
  return `${value.toLocaleString('pl-PL')} szt.`;
}

export function normalizeText(text: string): string {
  return text
    .toLocaleLowerCase('pl')
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function matchesStop(stop: OrderDayStop, query: string, status: StatusFilter): boolean {
  if (status !== 'all' && stop.status !== status) return false;
  const needle = normalizeText(query.trim());
  return !needle || normalizeText(`${stop.client_name} ${stop.address}`).includes(needle);
}

export function filterRoutes(routes: OrderDayRoute[], query: string, status: StatusFilter): OrderDayRoute[] {
  return routes
    .map((route) => ({ ...route, stops: route.stops.filter((stop) => matchesStop(stop, query, status)) }))
    .filter((route) => route.stops.length > 0);
}

export function statusSegments(byStatus: Record<OrderStatus, number>): { status: OrderStatus; count: number; share: number }[] {
  const total = STATUS_ORDER.reduce((sum, status) => sum + byStatus[status], 0);
  return STATUS_ORDER.filter((status) => byStatus[status] > 0).map((status) => ({
    status,
    count: byStatus[status],
    share: byStatus[status] / total,
  }));
}

export function plural(count: number, one: string, few: string, many: string): string {
  if (count === 1) return one;
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  return lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many;
}