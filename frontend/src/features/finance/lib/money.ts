export type ChangeTone = 'good' | 'bad' | 'neutral';

export interface Change {
  label: string;
  tone: ChangeTone;
}

export function formatMoney(value: string | number, { cents = false, sign = false } = {}): string {
  const amount = Number(value);
  const digits = cents ? 2 : 0;
  const formatted = Math.abs(amount).toLocaleString('pl-PL', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  const rounded = Number(Math.abs(amount).toFixed(digits));
  const prefix = rounded === 0 ? '' : amount < 0 ? '−' : sign ? '+' : '';
  return `${prefix}${formatted} zł`;
}

export function formatShare(part: string | number, whole: string | number): string {
  const total = Number(whole);
  if (total === 0) return '—';
  return `${Math.round((Number(part) / total) * 100)}%`;
}

export function changeVsPrevious(current: string | number, previous: string | number, kind: 'income' | 'cost'): Change {
  const now = Number(current);
  const before = Number(previous);
  if (before === 0) {
    return { label: now === 0 ? 'bez zmian' : 'brak porównania', tone: 'neutral' };
  }
  const percent = ((now - before) / Math.abs(before)) * 100;
  if (Math.abs(percent) < 0.05) return { label: 'bez zmian', tone: 'neutral' };
  const better = kind === 'income' ? percent > 0 : percent < 0;
  const arrow = percent > 0 ? '▲' : '▼';
  return {
    label: `${arrow} ${Math.abs(percent).toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%`,
    tone: better ? 'good' : 'bad',
  };
}