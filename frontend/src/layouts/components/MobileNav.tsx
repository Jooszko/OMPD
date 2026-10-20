import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';
import { NotificationBell } from '../../features/dashboard/components/NotificationBell';
import { useDialogFocus } from '../../features/dashboard/components/useDialogFocus';
import { bottomTabs, moreGroups, ROLE_LABELS, type UserRole } from '../navigation';
import { BrandMark, UserAvatar } from './Sidebar';

export function MobileTopBar({ title, showLogout, onLogout }: { title: string; showLogout: boolean; onLogout: () => void }) {
  return (
    <header className="shrink-0 h-14 flex items-center justify-between gap-2 pl-3.5 pr-2 bg-bakery-dark text-white font-auth">
      <span className="flex items-center gap-2.5 min-w-0">
        <BrandMark small />
        <span className="text-base font-extrabold truncate">{title}</span>
      </span>
      <span className="flex items-center">
        <NotificationBell variant="header" />
        {showLogout && (
          <button
            type="button"
            id="logout-button"
            onClick={onLogout}
            aria-label="Wyloguj"
            className="size-11 rounded-xl flex items-center justify-center text-white transition hover:bg-white/10"
          >
            <LogOut aria-hidden className="size-5" />
          </button>
        )}
      </span>
    </header>
  );
}

interface BottomNavProps {
  role: UserRole;
  active: string | null;
  moreOpen: boolean;
  onMore: () => void;
}

export function BottomNav({ role, active, moreOpen, onMore }: BottomNavProps) {
  const tabs = bottomTabs(role);
  const moreActive = moreOpen || (active !== null && !tabs.some((tab) => tab.path === active));
  const tabClass = (on: boolean) =>
    `min-w-0 flex flex-col items-center justify-center gap-1 rounded-xl no-underline font-auth ${on ? 'text-bakery-accent' : 'text-[#bdb5b2]'}`;
  const pillClass = (on: boolean) => `w-11 h-7 rounded-full flex items-center justify-center ${on ? 'bg-[#3a2a12]' : ''}`;

  return (
    <nav
      aria-label="Menu główne"
      className="shrink-0 grid gap-0.5 px-1.5 pt-1.5 pb-[calc(10px+env(safe-area-inset-bottom))] bg-bakery-dark"
      style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const on = !moreOpen && active === tab.path;
        return (
          <Link key={tab.path} to={tab.path} aria-current={on ? 'page' : undefined} className={tabClass(on)}>
            <span className={pillClass(on)}><Icon aria-hidden className="size-5" /></span>
            <span className="text-[11px] font-extrabold truncate max-w-full">{tab.short}</span>
          </Link>
        );
      })}
      <button type="button" onClick={onMore} aria-expanded={moreOpen} className={tabClass(moreActive)}>
        <span className={pillClass(moreActive)}><Menu aria-hidden className="size-5" /></span>
        <span className="text-[11px] font-extrabold">Więcej</span>
      </button>
    </nav>
  );
}

interface MoreSheetProps {
  role: UserRole;
  fullName: string;
  active: string | null;
  onClose: () => void;
  onLogout: () => void;
}

export function MoreSheet({ role, fullName, active, onClose, onLogout }: MoreSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useDialogFocus(sheetRef, onClose);

  return createPortal(
    <div className="fixed inset-0 z-[1700] flex flex-col justify-end font-auth">
      <button type="button" aria-label="Zamknij menu" onClick={onClose} className="flex-1 bg-black/55" />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Więcej zakładek"
        className="max-h-[85vh] overflow-y-auto bg-bakery-card text-bakery-dark rounded-t-[22px] px-4 pt-2.5 pb-[calc(18px+env(safe-area-inset-bottom))] flex flex-col gap-3.5"
      >
        <span aria-hidden className="self-center w-10 h-[5px] rounded-full bg-bakery-btnBorder" />
        {moreGroups(role).map((group) => (
          <section key={group.title ?? 'start'} className="flex flex-col gap-2">
            {group.title && (
              <h2 className="m-0 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#5f5a58]">{group.title}</h2>
            )}
            <div className="grid grid-cols-3 gap-2">
              {group.items.map((item) => {
                const Icon = item.icon;
                const on = active === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    aria-current={on ? 'page' : undefined}
                    className={`min-h-[74px] px-1 py-2 rounded-[14px] border flex flex-col items-center justify-center gap-1.5 text-center no-underline ${
                      on ? 'bg-bakery-accent border-bakery-accent text-bakery-dark' : 'bg-white border-[#e6e1df] text-bakery-dark'
                    }`}
                  >
                    <Icon aria-hidden className={`size-[22px] ${on ? 'text-bakery-dark' : 'text-[#3d3937]'}`} />
                    <span className="text-xs font-extrabold leading-tight">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
        <div className="flex items-center gap-2.5 pt-3 border-t border-[#e6e1df]">
          <UserAvatar fullName={fullName} />
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-sm font-extrabold truncate">{fullName}</span>
            <span className="text-xs font-semibold text-[#5f5a58]">{ROLE_LABELS[role]}</span>
          </span>
          <button
            type="button"
            id="logout-button"
            onClick={onLogout}
            className="min-h-10 px-3.5 rounded-[10px] border border-bakery-btnBorder bg-white text-[13px] font-extrabold text-bakery-dark"
          >
            Wyloguj
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}