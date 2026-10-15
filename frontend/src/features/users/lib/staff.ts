import type { AppUser, StaffUser } from '../../../services/api';
import { formatTime } from '../../dashboard/lib/dateFormat';

export type Role = AppUser['role'];
export type AccountStatus = 'active' | 'blocked' | 'pending';
export type StaffFilter = 'all' | Role | 'blocked' | 'pending';
export type StaffSort = 'name' | 'last_login';

export const ROLE_LABELS: Record<Role, string> = { admin: 'Kierownik', baker: 'Piekarz', driver: 'Kierowca' };

const ROLE_GROUPS: { role: Role; title: string }[] = [
  { role: 'admin', title: 'Kierownicy' },
  { role: 'baker', title: 'Piekarze' },
  { role: 'driver', title: 'Kierowcy' },
];

export function accountStatus(user: Pick<AppUser, 'is_active' | 'must_change_password'>): AccountStatus {
  if (!user.is_active) return 'blocked';
  return user.must_change_password ? 'pending' : 'active';
}

function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function matchesQuery(user: Pick<AppUser, 'full_name' | 'username'>, query: string): boolean {
  const needle = fold(query.trim());
  return !needle || fold(user.full_name).includes(needle) || fold(user.username).includes(needle);
}

export function matchesFilter(user: StaffUser, filter: StaffFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'blocked' || filter === 'pending') return accountStatus(user) === filter;
  return user.role === filter;
}

export function filterCounts(users: StaffUser[]): Record<StaffFilter, number> {
  const counts: Record<StaffFilter, number> = { all: users.length, admin: 0, baker: 0, driver: 0, blocked: 0, pending: 0 };
  for (const user of users) {
    counts[user.role] += 1;
    const status = accountStatus(user);
    if (status !== 'active') counts[status] += 1;
  }
  return counts;
}

function byName(a: StaffUser, b: StaffUser): number {
  return a.full_name.localeCompare(b.full_name, 'pl');
}

function loginTime(user: StaffUser): number {
  return user.last_login ? Date.parse(user.last_login) : 0;
}

export function sortStaff(users: StaffUser[], sort: StaffSort): StaffUser[] {
  if (sort === 'name') return [...users].sort(byName);
  return [...users].sort((a, b) => loginTime(b) - loginTime(a) || byName(a, b));
}

export interface RoleGroup {
  role: Role;
  title: string;
  users: StaffUser[];
}

export function groupByRole(users: StaffUser[]): RoleGroup[] {
  return ROLE_GROUPS.map((group) => ({ ...group, users: users.filter((user) => user.role === group.role) })).filter(
    (group) => group.users.length > 0
  );
}

export function initials(fullName: string): string {
  const parts = fullName.replace(/_/g, ' ').trim().split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase() || '?'
  );
}

export function suggestLogin(fullName: string, taken: string[]): string {
  const parts = fold(fullName)
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '';
  const base = parts.length === 1 ? parts[0] : parts[0].charAt(0) + parts[parts.length - 1];
  const used = new Set(taken.map((login) => login.toLowerCase()));
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}${suffix}`)) suffix += 1;
  return `${base}${suffix}`;
}

const PASSWORD_WORDS = [
  'Rogal', 'Chleb', 'Bulka', 'Drozdze', 'Maka', 'Mak', 'Sernik', 'Paczek',
  'Chalka', 'Precel', 'Kajzerka', 'Piernik', 'Babka', 'Zakwas', 'Bajgiel', 'Strucla',
  'Kruszon', 'Rodzynek', 'Cynamon', 'Wanilia', 'Orzech', 'Miod', 'Smalec', 'Bagietka',
];

function secureRandom(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] / 2 ** 32;
}

export function generatePassword(random: () => number = secureRandom): string {
  const word = () => PASSWORD_WORDS[Math.floor(random() * PASSWORD_WORDS.length)];
  const first = word();
  const digits = 1000 + Math.floor(random() * 9000);
  return `${first}-${digits}-${word()}`;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function formatLastLogin(value: string | null, now = new Date()): string {
  if (!value) return 'jeszcze nie';
  const date = new Date(value);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days <= 0) return `dziś, ${formatTime(date)}`;
  if (days === 1) return `wczoraj, ${formatTime(date)}`;
  if (days < 7) return `${days} dni temu`;
  return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatJoined(value: string): string {
  return new Date(value).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  return `${date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}, ${formatTime(date)}`;
}

export type HistoryTone = 'success' | 'danger' | 'change' | 'password' | 'neutral';

export function historyTone(action: string): HistoryTone {
  if (action === 'login.succeeded') return 'success';
  if (action.startsWith('login.')) return 'danger';
  if (action === 'user.updated') return 'change';
  if (action === 'user.password_reset' || action === 'password.initial_set') return 'password';
  return 'neutral';
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  try {
    const data = JSON.parse(error.message) as Record<string, unknown>;
    const messages = Object.values(data)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .filter((value): value is string => typeof value === 'string');
    if (messages.length > 0) return messages.join('\n');
  } catch {
    // not a JSON body from the server
  }
  return fallback;
}