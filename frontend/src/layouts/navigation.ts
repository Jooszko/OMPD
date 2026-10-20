import {
  Building2,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  History,
  House,
  LayoutGrid,
  Package,
  SlidersHorizontal,
  Truck,
  UserRound,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

export type UserRole = 'admin' | 'baker' | 'driver';

export interface NavItem {
  path: string;
  label: string;
  short: string;
  icon: LucideIcon;
  roles: UserRole[];
}

export interface NavGroup {
  title: string | null;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: null,
    items: [{ path: '/', label: 'Strona główna', short: 'Start', icon: House, roles: ['admin', 'baker'] }],
  },
  {
    title: 'Sprzedaż',
    items: [
      { path: '/orders', label: 'Zamówienia', short: 'Zamówienia', icon: ClipboardList, roles: ['admin', 'baker'] },
      { path: '/clients', label: 'Klienci', short: 'Klienci', icon: Users, roles: ['admin'] },
    ],
  },
  {
    title: 'Produkcja',
    items: [
      { path: '/production/board', label: 'Tablica produkcji', short: 'Tablica', icon: LayoutGrid, roles: ['admin', 'baker'] },
      { path: '/production', label: 'Planowanie produkcji', short: 'Plan', icon: CalendarDays, roles: ['admin', 'baker'] },
      { path: '/products', label: 'Produkty', short: 'Produkty', icon: Package, roles: ['admin', 'baker'] },
      { path: '/production/settings', label: 'Ustawienia produkcji', short: 'Ustawienia', icon: SlidersHorizontal, roles: ['admin'] },
    ],
  },
  {
    title: 'Magazyn i zakupy',
    items: [
      { path: '/warehouse', label: 'Magazyn', short: 'Magazyn', icon: Warehouse, roles: ['admin', 'baker'] },
      { path: '/contractors', label: 'Kontrahenci', short: 'Kontrahenci', icon: Building2, roles: ['admin'] },
    ],
  },
  {
    title: 'Dostawy',
    items: [
      { path: '/logistics', label: 'Logistyka', short: 'Logistyka', icon: Truck, roles: ['admin', 'driver'] },
      { path: '/delivery-stats', label: 'Statystyki dostaw', short: 'Statystyki', icon: ChartColumn, roles: ['admin'] },
    ],
  },
  {
    title: 'Firma',
    items: [
      { path: '/finance', label: 'Finanse', short: 'Finanse', icon: Wallet, roles: ['admin'] },
      { path: '/users', label: 'Użytkownicy', short: 'Użytkownicy', icon: UserRound, roles: ['admin'] },
      { path: '/audit-log', label: 'Dziennik zmian', short: 'Dziennik', icon: History, roles: ['admin'] },
    ],
  },
];

const BOTTOM_TABS: Record<UserRole, string[]> = {
  admin: ['/', '/orders', '/production/board', '/logistics'],
  baker: ['/', '/production/board', '/production', '/warehouse'],
  driver: [],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  baker: 'Piekarz',
  driver: 'Kierowca',
};

export function visibleGroups(role: UserRole): NavGroup[] {
  return NAV_GROUPS
    .map((group) => ({ ...group, items: group.items.filter((item) => item.roles.includes(role)) }))
    .filter((group) => group.items.length > 0);
}

export function activePath(pathname: string, role: UserRole): string | null {
  const matches = visibleGroups(role)
    .flatMap((group) => group.items)
    .filter((item) => (item.path === '/' ? pathname === '/' : pathname === item.path || pathname.startsWith(`${item.path}/`)));
  if (matches.length === 0) return null;
  return matches.reduce((best, item) => (item.path.length > best.path.length ? item : best)).path;
}

export function bottomTabs(role: UserRole): NavItem[] {
  const items = visibleGroups(role).flatMap((group) => group.items);
  return BOTTOM_TABS[role]
    .map((path) => items.find((item) => item.path === path))
    .filter((item): item is NavItem => item !== undefined);
}

export function moreGroups(role: UserRole): NavGroup[] {
  const tabs = new Set(BOTTOM_TABS[role]);
  return visibleGroups(role)
    .map((group) => ({ ...group, items: group.items.filter((item) => !tabs.has(item.path)) }))
    .filter((group) => group.items.length > 0);
}