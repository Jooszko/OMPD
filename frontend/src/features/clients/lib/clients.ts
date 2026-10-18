import type { AppClient, DeliveryStatus } from '../../../services/api';

export type ClientFilter = 'all' | 'active' | 'inactive' | 'unlocated';

export const WEEKDAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];
const WEEKDAY_LETTERS = ['P', 'W', 'Ś', 'C', 'P', 'S', 'N'];

export function isLocated(client: Pick<AppClient, 'latitude' | 'longitude'>): boolean {
  return client.latitude !== null && client.longitude !== null;
}

function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function digits(text: string): string {
  return text.replace(/\D/g, '');
}

export function matchesClientQuery(client: AppClient, query: string): boolean {
  const needle = fold(query.trim());
  if (!needle) return true;
  if (fold(`${client.name} ${client.address}`).includes(needle)) return true;
  const numbers = digits(needle);
  return numbers.length >= 3 && (digits(client.phone).includes(numbers) || digits(client.nip ?? '').includes(numbers));
}

export function matchesClientFilter(client: AppClient, filter: ClientFilter): boolean {
  if (filter === 'active') return client.is_active;
  if (filter === 'inactive') return !client.is_active;
  if (filter === 'unlocated') return !isLocated(client);
  return true;
}

export function clientCounts(clients: AppClient[]): Record<ClientFilter, number> {
  const counts: Record<ClientFilter, number> = { all: clients.length, active: 0, inactive: 0, unlocated: 0 };
  for (const client of clients) {
    counts[client.is_active ? 'active' : 'inactive'] += 1;
    if (!isLocated(client)) counts.unlocated += 1;
  }
  return counts;
}

export interface RouteGroup {
  routeId: number;
  name: string;
  driver: string | null;
  clients: AppClient[];
}

export function groupByRoute(clients: AppClient[]): RouteGroup[] {
  const groups = new Map<number, RouteGroup>();
  for (const client of clients) {
    let group = groups.get(client.route);
    if (!group) {
      group = {
        routeId: client.route,
        name: client.route_details?.route_name ?? 'Bez trasy',
        driver: client.route_details?.driver_name ?? null,
        clients: [],
      };
      groups.set(client.route, group);
    }
    group.clients.push(client);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'pl', { numeric: true }));
}

export function weekStrip(days: number[]): { label: string; letter: string; active: boolean }[] {
  return WEEKDAYS.map((label, index) => ({ label, letter: WEEKDAY_LETTERS[index], active: days.includes(index) }));
}

export function formatDays(days: number[]): string {
  return days.length === 0 ? 'brak stałych zamówień' : days.map((day) => WEEKDAYS[day]).join(', ');
}

export function formatPhone(phone: string): string {
  const match = /^(\+\d{2})?(\d{3})(\d{3})(\d{3})$/.exec(phone);
  if (!match) return phone;
  const [, prefix, ...groups] = match;
  return [prefix, ...groups].filter(Boolean).join(' ');
}

export function formatNip(nip: string): string {
  return /^\d{10}$/.test(nip) ? `${nip.slice(0, 3)}-${nip.slice(3, 6)}-${nip.slice(6, 8)}-${nip.slice(8)}` : nip;
}

const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7];

export function isValidNip(value: string): boolean {
  const nip = digits(value);
  if (nip.length !== 10) return false;
  const checksum = NIP_WEIGHTS.reduce((sum, weight, index) => sum + weight * Number(nip[index]), 0) % 11;
  return checksum !== 10 && checksum === Number(nip[9]);
}

export type DeliveryTone = 'success' | 'danger' | 'muted' | 'info';

export function deliveryTone(status: DeliveryStatus): DeliveryTone {
  if (status === 'delivered') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'cancelled') return 'muted';
  return 'info';
}

export function formatDeliveryDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' });
}