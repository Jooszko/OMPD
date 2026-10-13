import { shiftIsoDate, toIsoDate } from '../../dashboard/lib/dateFormat';

export type PeriodPreset = '7' | '30' | 'month' | 'custom';

export interface FinancePeriod {
  preset: PeriodPreset;
  start: string;
  end: string;
}

export const PERIOD_PRESETS: { id: Exclude<PeriodPreset, 'custom'>; label: string }[] = [
  { id: '7', label: '7 dni' },
  { id: '30', label: '30 dni' },
  { id: 'month', label: 'Ten miesiąc' },
];

export function presetPeriod(preset: Exclude<PeriodPreset, 'custom'>, today = toIsoDate(new Date())): FinancePeriod {
  if (preset === 'month') return { preset, start: `${today.slice(0, 8)}01`, end: today };
  const days = preset === '7' ? 7 : 30;
  return { preset, start: shiftIsoDate(today, -(days - 1)), end: today };
}

export function periodLength(start: string, end: string): number {
  const ms = new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

function dayMonth(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${day}.${month}`;
}

export function periodLabel(start: string, end: string): string {
  const endYear = end.slice(0, 4);
  const startText = start.slice(0, 4) === endYear ? dayMonth(start) : `${dayMonth(start)}.${start.slice(0, 4)}`;
  return start === end ? `${dayMonth(end)}.${endYear}` : `${startText} – ${dayMonth(end)}.${endYear}`;
}

export function comparisonLabel(start: string, end: string): string {
  const days = periodLength(start, end);
  return days === 1 ? 'vs poprzedni dzień' : `vs poprzednie ${days} dni`;
}