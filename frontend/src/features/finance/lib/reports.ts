import type { ReportPeriodKind, StatementLine } from '../../../services/api';
import { toIsoDate } from '../../dashboard/lib/dateFormat';

export const PERIOD_KIND_LABELS: Record<ReportPeriodKind, string> = {
  month: 'Miesiąc',
  quarter: 'Kwartał',
  year: 'Rok',
};

export function periodStart(kind: ReportPeriodKind, anchor: string): string {
  const [year, month] = anchor.split('-').map(Number);
  if (kind === 'year') return `${year}-01-01`;
  const firstMonth = kind === 'quarter' ? Math.floor((month - 1) / 3) * 3 + 1 : month;
  return `${year}-${String(firstMonth).padStart(2, '0')}-01`;
}

export function shiftPeriod(kind: ReportPeriodKind, anchor: string, direction: 1 | -1): string {
  const [year, month] = periodStart(kind, anchor).split('-').map(Number);
  if (kind === 'year') return `${year + direction}-01-01`;
  const step = kind === 'quarter' ? 3 : 1;
  return toIsoDate(new Date(year, month - 1 + direction * step, 1));
}

export function canGoForward(kind: ReportPeriodKind, anchor: string, today: string): boolean {
  return shiftPeriod(kind, anchor, 1) <= today;
}

export function isCostLine(line: StatementLine): boolean {
  return !['sales', 'revenue', 'gross_margin', 'net_profit'].includes(line.key);
}

export interface CalendarCell {
  date: string | null;
  day: number | null;
  value: number | null;
}

export function calendarCells(monthStart: string, days: { date: string; net_profit: string }[]): CalendarCell[] {
  const [year, month] = monthStart.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leading = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const values = new Map(days.map((day) => [day.date, Number(day.net_profit)]));
  const cells: CalendarCell[] = Array.from({ length: leading }, () => ({ date: null, day: null, value: null }));
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${monthStart.slice(0, 8)}${String(day).padStart(2, '0')}`;
    cells.push({ date, day, value: values.get(date) ?? null });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null, value: null });
  return cells;
}

const GAIN_STEPS = ['#cfe0f6', '#6fa2e3', '#2a78d6'];
const LOSS_STEPS = ['#fbd5d5', '#f19a9a', '#b91c1c'];
export const DAY_SCALE = [...[...LOSS_STEPS].reverse(), '#ebe7e7', ...GAIN_STEPS];

export function dayTone(value: number | null, maxGain: number, maxLoss: number): { background: string; color: string } {
  if (value === null) return { background: 'transparent', color: '#8a8482' };
  const rounded = Math.round(value);
  if (rounded === 0) return { background: '#ebe7e7', color: '#3d3937' };
  const steps = rounded > 0 ? GAIN_STEPS : LOSS_STEPS;
  const ratio = Math.abs(value) / Math.max(1, rounded > 0 ? maxGain : maxLoss);
  const index = ratio > 2 / 3 ? 2 : ratio > 1 / 3 ? 1 : 0;
  return { background: steps[index], color: index === 2 ? '#ffffff' : '#1a1a1a' };
}

export function compactMoney(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
  const size = Math.abs(rounded);
  const text = size >= 1000 ? `${(size / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 1 })}k` : String(size);
  return `${sign}${text}`;
}