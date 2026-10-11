import type { AuditEntry } from '../../../services/api';
import { formatDayLabel, shiftIsoDate, toIsoDate } from './dateFormat';

export interface AuditDayGroup {
  day: string;
  label: string;
  entries: AuditEntry[];
}

export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Tak' : 'Nie';
  return String(value);
}

export function formatEntryCount(count: number): string {
  const last = count % 10;
  const lastTwo = count % 100;
  if (count === 1) return '1 wpis';
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} wpisy`;
  return `${count} wpisów`;
}

function dayLabel(day: string, today: string): string {
  if (day === today) return 'Dziś';
  if (day === shiftIsoDate(today, -1)) return 'Wczoraj';
  return formatDayLabel(day);
}

export function groupEntriesByDay(entries: AuditEntry[], today = toIsoDate(new Date())): AuditDayGroup[] {
  const groups: AuditDayGroup[] = [];
  for (const entry of entries) {
    const day = toIsoDate(new Date(entry.created_at));
    const last = groups[groups.length - 1];
    if (last?.day === day) {
      last.entries.push(entry);
    } else {
      groups.push({ day, label: dayLabel(day, today), entries: [entry] });
    }
  }
  return groups;
}