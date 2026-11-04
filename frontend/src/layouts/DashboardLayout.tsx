import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { DashboardListScrollbar } from '../features/dashboard/components/DashboardListScrollbar';
import { logoutUser, fetchCurrentUser, revokeSession, type AppUser } from '../services/api';
import { clearQueue, loadQueue, syncQueue } from '../services/actionQueue';
import { BottomNav, MobileTopBar, MoreSheet } from './components/MobileNav';
import { Sidebar } from './components/Sidebar';
import { activePath, bottomTabs, NAV_GROUPS } from './navigation';
import { useMediaQuery } from './useMediaQuery';

const COLLAPSED_KEY = 'bakery-flow.sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function pageTitle(pathname: string, active: string | null): string {
  const item = NAV_GROUPS.flatMap((group) => group.items).find((entry) => entry.path === active);
  if (item) return item.label;
  if (pathname.startsWith('/notifications')) return 'Powiadomienia';
  return 'BakeryOS';
}

export const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [moreOpenAt, setMoreOpenAt] = useState<string | null>(null);

  useEffect(() => {
    fetchCurrentUser()
      .then((user) => {
        if (user.must_change_password) {
          navigate('/set-password', { replace: true });
          return;
        }
        setCurrentUser(user);
      })
      .catch((err) => {
        console.error('Błąd podczas ładowania danych konta:', err);
        setLoadError(true);
      });
  }, [navigate]);

  const handleLogout = async () => {
    if (navigator.onLine) await syncQueue().catch(() => undefined);
    const pending = await loadQueue();
    if (pending.length > 0) {
      const confirmed = window.confirm(
        `Masz ${pending.length} niewysłanych akcji zapisanych w telefonie (brak połączenia z serwerem). ` +
          'Wylogowanie je usunie i nie trafią do biura.\n\nCzy na pewno chcesz się wylogować?'
      );
      if (!confirmed) return;
    }
    await clearQueue();
    await revokeSession();
    logoutUser();
    navigate('/login', { replace: true });
  };

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      return;
    }
  };

  if (!currentUser) {
    return (
      <div className="w-screen h-[100dvh] flex flex-col items-center justify-center gap-4 bg-bakery-main font-auth text-bakery-dark">
        {loadError ? (
          <>
            <p role="alert" className="m-0 text-sm font-bold">
              Nie udało się wczytać danych konta.
            </p>
            <button
              type="button"
              onClick={handleLogout}
              className="min-h-11 px-[18px] rounded-xl bg-bakery-dark text-white text-sm font-extrabold"
            >
              Wróć do logowania
            </button>
          </>
        ) : (
          <span role="status" className="text-sm font-bold text-[#5f5a58]">
            Ładowanie…
          </span>
        )}
      </div>
    );
  }

  const role = currentUser.role;
  const active = activePath(location.pathname, role);
  const moreOpen = moreOpenAt === location.pathname;
  const hasTabs = bottomTabs(role).length > 0;

  const content = (
    <main className="flex-1 h-full min-h-0 overflow-hidden bg-bakery-main">
      <DashboardListScrollbar
        className="dashboard-main-scrollbar h-full"
        contentClassName="min-h-full p-4 md:p-6 box-border"
        thumbTrackPadding={8}
      >
        <div className="w-full min-h-full">
          <Outlet context={{ currentRole: role }} />
        </div>
      </DashboardListScrollbar>
    </main>
  );

  if (isDesktop) {
    return (
      <div className="flex w-screen h-screen bg-bakery-main overflow-hidden font-sans select-none">
        <Sidebar
          role={role}
          fullName={currentUser.full_name}
          active={active}
          collapsed={collapsed}
          onToggle={toggleCollapsed}
          onLogout={handleLogout}
        />
        {content}
      </div>
    );
  }

  return (
    <div className="flex flex-col w-screen h-[100dvh] bg-bakery-main overflow-hidden font-sans select-none">
      <MobileTopBar title={pageTitle(location.pathname, active)} showLogout={!hasTabs} onLogout={handleLogout} />
      {content}
      {hasTabs && (
        <BottomNav role={role} active={active} moreOpen={moreOpen} onMore={() => setMoreOpenAt(location.pathname)} />
      )}
      {moreOpen && (
        <MoreSheet
          role={role}
          fullName={currentUser.full_name}
          active={active}
          onClose={() => setMoreOpenAt(null)}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
};
