import type { FinanceOverviewDay } from '../../../services/api';
import { shiftIsoDate } from '../../dashboard/lib/dateFormat';

export type BucketSize = 'day' | 'week' | 'month';

export interface Bucket {
  start: string;
  end: string;
  label: string;
  revenue: number;
  cogs: number;
  operating: number;
  costs: number;
  result: number;
  expenses: { label: string; amount: number }[];
}

export const BUCKET_TITLES: Record<BucketSize, string> = {
  day: 'dziennie',
  week: 'tygodniowo',
  month: 'miesięcznie',
};

export function bucketSizeFor(dayCount: number): BucketSize {
  if (dayCount <= 14) return 'day';
  if (dayCount <= 92) return 'week';
  return 'month';
}

function mondayOf(isoDate: string): string {
  const weekday = new Date(`${isoDate}T00:00:00`).getDay();
  return shiftIsoDate(isoDate, -((weekday + 6) % 7));
}

function bucketKey(isoDate: string, size: BucketSize): string {
  if (size === 'day') return isoDate;
  if (size === 'week') return mondayOf(isoDate);
  return isoDate.slice(0, 7);
}

function dayMonth(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${day}.${month}`;
}

export function bucketLabel(start: string, end: string, size: BucketSize): string {
  if (size === 'day') return dayMonth(start);
  if (size === 'month') {
    return new Date(`${start}T00:00:00`).toLocaleDateString('pl-PL', { month: 'short', year: 'numeric' });
  }
  if (start === end) return dayMonth(start);
  return start.slice(5, 7) === end.slice(5, 7) ? `${start.slice(8)}–${dayMonth(end)}` : `${dayMonth(start)}–${dayMonth(end)}`;
}

export function bucketDays(days: FinanceOverviewDay[], size: BucketSize): Bucket[] {
  const keys: string[] = [];
  const buckets: (Bucket & { byLabel: Map<string, number> })[] = [];
  for (const day of days) {
    const key = bucketKey(day.date, size);
    let bucket = buckets[buckets.length - 1];
    if (!bucket || keys[keys.length - 1] !== key) {
      keys.push(key);
      bucket = {
        start: day.date,
        end: day.date,
        label: '',
        revenue: 0,
        cogs: 0,
        operating: 0,
        costs: 0,
        result: 0,
        expenses: [],
        byLabel: new Map(),
      };
      buckets.push(bucket);
    }
    bucket.end = day.date;
    bucket.revenue += Number(day.revenue);
    bucket.cogs += Number(day.cogs);
    bucket.operating += Number(day.operating_expenses);
    for (const expense of day.expenses) {
      bucket.byLabel.set(expense.label, (bucket.byLabel.get(expense.label) ?? 0) + Number(expense.amount));
    }
  }
  return buckets.map(({ byLabel, ...bucket }) => ({
    ...bucket,
    label: bucketLabel(bucket.start, bucket.end, size),
    costs: bucket.cogs + bucket.operating,
    result: bucket.revenue - bucket.cogs - bucket.operating,
    expenses: [...byLabel].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount),
  }));
}