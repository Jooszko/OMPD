import { Link } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight, LogOut } from 'lucide-react';
import logo from '../../assets/logo.png';
import { NotificationBell } from '../../features/dashboard/components/NotificationBell';
import { ROLE_LABELS, visibleGroups, type NavItem, type UserRole } from '../navigation';

export function BrandMark({ small = false }: { small?: boolean }) {
  return <img src={logo} alt="" aria-hidden className={`shrink-0 ${small ? 'size-8' : 'size-10'}`} />;
}

export function UserAvatar({ fullName }: { fullName: string }) {
  return (
    <span aria-hidden className="shrink-0 size-[38px] rounded-full bg-bakery-accent text-bakery-dark flex items-center justify-center text-[15px] font-extrabold">
      {fullName.charAt(0).toUpperCase() || '?'}
    </span>
  );
}

function NavLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={`min-h-[38px] flex items-center gap-3 px-3 rounded-[11px] text-sm no-underline transition ${collapsed ? 'justify-center' : ''} ${
        active ? 'bg-bakery-accent text-bakery-dark font-extrabold' : 'text-[#d9d2cf] font-bold hover:bg-[#262221] hover:text-white'
      }`}
    >
      <Icon aria-hidden className={`size-5 shrink-0 ${active ? 'text-bakery-dark' : 'text-[#bdb5b2]'}`} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

interface SidebarProps {
  role: UserRole;
  fullName: string;
  active: string | null;
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
}

export function Sidebar({ role, fullName, active, collapsed, onToggle, onLogout }: SidebarProps) {
  const groups = visibleGroups(role);
  const top = groups.filter((group) => group.title === null).flatMap((group) => group.items);
  const sections = groups.filter((group) => group.title !== null);
  const ToggleIcon = collapsed ? ChevronsRight : ChevronsLeft;
  const toggleLabel = collapsed ? 'Rozwiń menu' : 'Zwiń menu';

  return (
    <aside
      aria-label="Menu główne"
      className={`shrink-0 h-full flex flex-col bg-bakery-dark text-white font-auth transition-[width] duration-200 ${collapsed ? 'w-[76px]' : 'w-[264px]'}`}
    >
      <div className={`flex items-center gap-2.5 pt-4 pb-3 ${collapsed ? 'flex-col px-0' : 'justify-between px-[18px]'}`}>
        <span className="flex items-center gap-2.5 min-w-0">
          <BrandMark />
          {!collapsed && (
            <span className="flex flex-col min-w-0">
              <span className="font-display text-lg leading-tight font-extrabold">Bakery Flow</span>
              <span className="text-[11px] font-bold tracking-[0.12em] text-[#a8a09d]">PIEKARNIA · ERP</span>
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-label={toggleLabel}
          title={toggleLabel}
          className="shrink-0 size-9 rounded-[10px] bg-[#262221] text-[#d9d2cf] flex items-center justify-center transition hover:text-white"
        >
          <ToggleIcon aria-hidden className="size-[18px]" />
        </button>
      </div>

      <nav className="sidebar-nav-scrollbar flex-1 min-h-0 overflow-y-auto px-3 pt-1 pb-3 flex flex-col gap-2.5">
        <div className="flex flex-col gap-0.5">
          {top.map((item) => (
            <NavLink key={item.path} item={item} active={active === item.path} collapsed={collapsed} />
          ))}
          <NotificationBell variant="sidebar" collapsed={collapsed} />
        </div>
        {sections.map((group) => (
          <div key={group.title} className="flex flex-col gap-0.5">
            {collapsed ? (
              <span aria-hidden className="h-px mx-2.5 mb-1 bg-[#34302f]" />
            ) : (
              <span className="px-3 pb-1 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#a8a09d]">{group.title}</span>
            )}
            {group.items.map((item) => (
              <NavLink key={item.path} item={item} active={active === item.path} collapsed={collapsed} />
            ))}
          </div>
        ))}
      </nav>

      <div className={`border-t border-[#2e2a29] py-3.5 flex items-center gap-2.5 ${collapsed ? 'flex-col px-0' : 'px-[18px]'}`}>
        <UserAvatar fullName={fullName} />
        {!collapsed && (
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-sm font-extrabold truncate">{fullName}</span>
            <span className="text-xs font-semibold text-[#a8a09d]">{ROLE_LABELS[role]}</span>
          </span>
        )}
        <button
          type="button"
          id="logout-button"
          onClick={onLogout}
          aria-label="Wyloguj"
          title="Wyloguj"
          className="shrink-0 size-[38px] rounded-[10px] text-[#a8a09d] flex items-center justify-center transition hover:bg-[#262221] hover:text-bakery-accent"
        >
          <LogOut aria-hidden className="size-[18px]" />
        </button>
      </div>
    </aside>
  );
}