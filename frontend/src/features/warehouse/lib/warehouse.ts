import type { StockDay, StockMovementKind, WarehouseRow } from '../../../services/api';
import { niceRange } from '../../finance/lib/chart';
import { plural, type Segment } from '../../home/lib/home';

export type StockStatus = 'critical' | 'warning' | 'good';

const WARNING_RATIO = 1.5;

export const STATUS_ORDER: StockStatus[] = ['critical', 'warning', 'good'];

export const STATUS_LABELS: Record<StockStatus, string> = {
  critical: 'Poniżej minimum',
  warning: 'Blisko minimum',
  good: 'W normie',
};

export const STATUS_COLORS: Record<StockStatus, string> = {
  critical: '#e5484d',
  warning: '#f49f1c',
  good: '#3fb565',
};

export const MOVEMENT_LABELS: Record<StockMovementKind, string> = {
  initial: 'Stan początkowy',
  delivery: 'Przyjęcie dostawy',
  production: 'Zużycie w produkcji',
  loss: 'Rozchód / strata',
  count: 'Inwentaryzacja',
};

export const PERIODS = [30, 90, 180] as const;
export type Period = (typeof PERIODS)[number];

export const UNIT_OPTIONS = ['kg', 'l', 'szt'];

export interface StockItem extends WarehouseRow {
  current: number;
  minimum: number;
  usage: number;
  status: StockStatus;
}

export function stockStatus(current: number, minimum: number): StockStatus {
  if (minimum <= 0) return 'good';
  if (current < minimum) return 'critical';
  if (current < minimum * WARNING_RATIO) return 'warning';
  return 'good';
}

export function toStockItem(row: WarehouseRow): StockItem {
  const current = Number(row.current_stock);
  const minimum = Number(row.min_stock_level);
  return { ...row, current, minimum, usage: Number(row.daily_usage), status: stockStatus(current, minimum) };
}

export function byUrgency(a: StockItem, b: StockItem): number {
  const status = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
  if (status !== 0) return status;
  const daysA = a.days_left ?? Infinity;
  const daysB = b.days_left ?? Infinity;
  if (daysA !== daysB) return daysA - daysB;
  return a.name.localeCompare(b.name, 'pl');
}

export function formatQty(value: number, unit?: string): string {
  const size = Math.abs(value);
  const digits = size >= 100 ? 0 : size >= 10 ? 1 : 2;
  const text = value.toLocaleString('pl-PL', { maximumFractionDigits: digits });
  return unit ? `${text} ${unit}` : text;
}

export function formatDays(days: number | null): string {
  if (days === null) return 'brak zużycia';
  if (days < 1) return 'mniej niż dzień';
  const rounded = Math.floor(days);
  return `${rounded} ${plural(rounded, 'dzień', 'dni', 'dni')}`;
}

export function formatDate(value: string | null, withYear = false): string {
  if (!value) return '—';
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
}

export function statusCounts(items: StockItem[]): Record<StockStatus, number> {
  const counts: Record<StockStatus, number> = { critical: 0, warning: 0, good: 0 };
  for (const item of items) counts[item.status] += 1;
  return counts;
}

export function headline(items: StockItem[]): string {
  const { critical, warning } = statusCounts(items);
  if (items.length === 0) return 'Magazyn jest pusty';
  if (critical > 0) return `${critical} ${plural(critical, 'surowiec', 'surowce', 'surowców')} poniżej minimum`;
  if (warning > 0) return `${warning} ${plural(warning, 'surowiec', 'surowce', 'surowców')} do zamówienia`;
  return 'Zapasy w normie';
}

export function summary(items: StockItem[]): Segment[] {
  if (items.length === 0) return [{ text: 'Dodaj pierwszy składnik, żeby śledzić jego stan i zużycie.' }];
  const urgent = [...items].filter((item) => item.status !== 'good').sort(byUrgency).slice(0, 2);
  const good = statusCounts(items).good;
  const segments: Segment[] = [];
  urgent.forEach((item, index) => {
    segments.push({ text: index === 0 ? '' : ', ' });
    segments.push({ text: item.name, strong: true });
    segments.push({ text: item.days_left === null ? ' bez zużycia' : ` starczy na ${formatDays(item.days_left)}` });
  });
  if (urgent.length > 0) segments.push({ text: '. ' });
  segments.push({ text: `${good} z ${items.length} ` });
  segments.push({ text: `${plural(items.length, 'surowca', 'surowców', 'surowców')} ma bezpieczny zapas.` });
  return segments.filter((segment) => segment.text);
}

export const BAR_MIN_POSITION = 1 / 4;

export function stockBar(item: StockItem): { fill: number; overflow: boolean } {
  if (item.minimum <= 0) return { fill: item.current > 0 ? 1 : 0, overflow: false };
  const fill = (item.current / item.minimum) * BAR_MIN_POSITION;
  return { fill: Math.max(0, Math.min(1, fill)), overflow: fill > 1 };
}

export interface ChartPoint {
  x: number;
  y: number;
  day: StockDay;
  balance: number;
  received: number;
  used: number;
  corrected: number;
}

export interface ChartGeometry {
  points: ChartPoint[];
  ticks: { value: number; y: number }[];
  minimumY: number | null;
  line: string;
  area: string;
}

export function chartGeometry(series: StockDay[], minimum: number, width: number, height: number): ChartGeometry {
  const balances = series.map((day) => Number(day.balance));
  const { min, max, ticks } = niceRange([...balances, minimum * 1.1]);
  const span = max - min || 1;
  const yOf = (value: number) => height - ((value - min) / span) * height;
  const step = series.length > 1 ? width / (series.length - 1) : 0;
  const points = series.map((day, index) => ({
    x: series.length > 1 ? index * step : width / 2,
    y: yOf(Number(day.balance)),
    day,
    balance: Number(day.balance),
    received: Number(day.received),
    used: Number(day.used),
    corrected: Number(day.corrected),
  }));
  const line = points.map((p, index) => `${index === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const baseline = yOf(Math.max(min, 0));
  const area = points.length
    ? `${line} L${points[points.length - 1].x.toFixed(1)},${baseline.toFixed(1)} L${points[0].x.toFixed(1)},${baseline.toFixed(1)} Z`
    : '';
  return {
    points,
    ticks: ticks.map((value) => ({ value, y: yOf(value) })),
    minimumY: minimum > 0 ? yOf(minimum) : null,
    line,
    area,
  };
}

export function nearestIndex(points: ChartPoint[], x: number): number {
  if (points.length < 2) return 0;
  const step = points[1].x - points[0].x;
  return Math.max(0, Math.min(points.length - 1, Math.round(x / step)));
}

export function weightedPrice(held: number, price: number | null, amount: number, unitPrice: number): number {
  const weight = Math.max(held, 0);
  if (price === null || weight === 0) return unitPrice;
  return Math.round(((weight * price + amount * unitPrice) / (weight + amount)) * 100) / 100;
}

export function parsePrice(text: string): number | null {
  const normalized = text.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  return value > 0 ? value : null;
}

export function parseQuantity(text: string): number | null {
  const normalized = text.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,3})?$/.test(normalized)) return null;
  return Number(normalized);
}
