import React, { useEffect, useRef, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { NotificationBell } from '../features/dashboard/components/NotificationBell';
import { DashboardListScrollbar } from '../features/dashboard/components/DashboardListScrollbar';
import { logoutUser, fetchCurrentUser, revokeSession, type AppUser } from '../services/api';
import { clearQueue, loadQueue, syncQueue } from '../services/actionQueue';

type UserRole = 'admin' | 'baker' | 'driver';

export const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [menuScrollbar, setMenuScrollbar] = useState({ height: 0, top: 0 });
  const menuScrollRef = useRef<HTMLElement>(null);
  const menuScrollDragRef = useRef<{ pointerId: number; startY: number; startScrollTop: number } | null>(null);

  useEffect(() => {
    fetchCurrentUser()
      .then((user) => {
        if (user.must_change_password) {
          navigate('/set-password', { replace: true });
          return;
        }
        setCurrentUser(user);
        setCurrentRole(user.role);
      })
      .catch((err) => console.error('Błąd podczas ładowania danych konta:', err));
  }, [navigate]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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

  const menuItems = [
    { path: '/', label: 'Strona Główna', roles: ['admin', 'baker'] },
    { path: '/orders', label: 'Zamówienia', roles: ['admin', 'baker'] },
    { path: '/production/board', label: 'Tablica produkcji', roles: ['admin', 'baker'] },
    { path: '/production', label: 'Planowanie produkcji', roles: ['admin', 'baker'] },
    { path: '/production/settings', label: 'Ustawienia produkcji', roles: ['admin'] },
    { path: '/warehouse', label: 'Magazyn', roles: ['admin', 'baker'] },
    { path: '/logistics', label: 'Logistyka', roles: ['admin', 'driver'] },
    { path: '/delivery-stats', label: 'Statystyki dostaw', roles: ['admin'] },
    { path: '/products', label: 'Produkty', roles: ['admin', 'baker'] },
    { path: '/finance', label: 'Finanse', roles: ['admin'] },
    { path: '/users', label: 'Użytkownicy', roles: ['admin'] },
    { path: '/audit-log', label: 'Dziennik zmian', roles: ['admin'] },
    { path: '/clients', label: 'Klienci', roles: ['admin'] },
    { path: '/contractors', label: 'Kontrahenci', roles: ['admin'] },
  ];

  const visibleMenuItems = menuItems.filter(item => item.roles.includes(currentRole));

  const updateMenuScrollbar = () => {
    const menu = menuScrollRef.current;
    if (!menu) return;

    const maxScrollTop = menu.scrollHeight - menu.clientHeight;
    const height = maxScrollTop > 0
      ? Math.min(menu.clientHeight, Math.max(24, (menu.clientHeight * menu.clientHeight) / menu.scrollHeight))
      : 0;
    const top = maxScrollTop > 0
      ? (menu.scrollTop / maxScrollTop) * (menu.clientHeight - height)
      : 0;

    setMenuScrollbar((current) =>
      current.height === height && current.top === top ? current : { height, top }
    );
  };

  useEffect(() => {
    const menu = menuScrollRef.current;
    const content = menu?.firstElementChild;
    if (!menu || !content) return;

    const observer = new ResizeObserver(updateMenuScrollbar);
    observer.observe(menu);
    observer.observe(content);
    const frame = requestAnimationFrame(updateMenuScrollbar);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [visibleMenuItems.length]);

  const handleMenuScrollbarPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const menu = menuScrollRef.current;
    if (!menu) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    menuScrollDragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScrollTop: menu.scrollTop,
    };
  };

  const handleMenuScrollbarPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const menu = menuScrollRef.current;
    const drag = menuScrollDragRef.current;
    const scrollRange = menu ? menu.clientHeight - menuScrollbar.height : 0;
    if (!menu || !drag || drag.pointerId !== event.pointerId || scrollRange <= 0) return;

    const maxScrollTop = menu.scrollHeight - menu.clientHeight;
    menu.scrollTop = drag.startScrollTop + ((event.clientY - drag.startY) / scrollRange) * maxScrollTop;
  };

  const getRoleLabel = (role: UserRole) => {
    if (role === 'admin') return 'Administrator';
    if (role === 'baker') return 'Piekarz';
    if (role === 'driver') return 'Kierowca';
    return role;
  };

  return (
    <div className="flex flex-col md:flex-row w-screen h-screen bg-bakery-main overflow-hidden font-sans select-none">

      <header className="md:hidden flex items-center justify-between h-14 px-4 bg-bakery-dark text-white shrink-0 z-20 box-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-bakery-accent rounded-lg flex items-center justify-center shadow-md">
            <span className="text-white text-base font-bold">🍞</span>
          </div>
          <span className="font-bold text-sm tracking-wide">Bakery Flow</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 -mr-2 text-white"
          aria-label="Otwórz menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}
      
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-[240px] min-w-[240px] bg-bakery-main border-r border-bakery-border flex flex-col justify-between h-full box-border overflow-hidden transform transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col w-full min-h-0 flex-1">
          <div className="h-[120px] bg-bakery-dark p-4 flex items-center justify-between gap-3 border-b border-bakery-border box-border shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-bakery-accent rounded-xl flex items-center justify-center shadow-md box-border">
                <span className="text-white text-2xl font-bold">🍞</span>
              </div>
              <div className="flex flex-col text-white">
                <span className="font-bold text-lg leading-tight tracking-wide">Bakery Flow</span>
                <span className="text-xs text-gray-400 tracking-widest">ERP System</span>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden text-white p-1"
              aria-label="Zamknij menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="sidebar-menu-scroll-container relative flex-1 min-h-0">
            <nav
              ref={menuScrollRef}
              onScroll={updateMenuScrollbar}
              className="sidebar-menu-scrollbar h-full min-h-0 overflow-y-auto"
            >
              <div className="flex flex-col gap-1.5 p-3 mt-2 pr-3.5">
                <NotificationBell />
                <hr className="border-0 border-t border-bakery-border my-1 shrink-0" />

                {visibleMenuItems.map((item) => {
                  const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
              
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`w-full h-[40px] min-h-[40px] flex items-center justify-center no-underline text-sm font-medium rounded shadow-sm transition-all duration-150 box-border shrink-0 ${
                        isActive 
                          ? 'bg-bakery-dark text-white border border-bakery-dark' 
                          : 'bg-bakery-inactive text-bakery-dark border border-bakery-btnBorder hover:bg-[#dcd8d8] active:scale-[0.99]'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </nav>
            {menuScrollbar.height > 0 && (
              <div
                aria-hidden="true"
                className="sidebar-menu-thumb absolute right-1 top-0 w-1 rounded-full bg-bakery-dark touch-none cursor-pointer"
                style={{ height: menuScrollbar.height, transform: `translateY(${menuScrollbar.top}px)` }}
                onPointerDown={handleMenuScrollbarPointerDown}
                onPointerMove={handleMenuScrollbarPointerMove}
                onPointerUp={() => { menuScrollDragRef.current = null; }}
                onPointerCancel={() => { menuScrollDragRef.current = null; }}
              />
            )}
          </div>
        </div>

        <div className="bg-bakery-dark p-4 border-t border-bakery-border text-white flex flex-col gap-2 box-border shrink-0">
          
          <div className="mb-2">
            <label className="text-[10px] text-gray-400 block mb-1">
              Widok roli:
            </label>
            <select 
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value as UserRole)}
              className="w-full bg-[#27272a] text-white border border-[#3f3f46] rounded p-1 text-xs cursor-pointer outline-none box-border focus:border-bakery-accent"
            >
              <option value="admin">Właściciel</option>
              <option value="baker">Piekarz</option>
              <option value="driver">Kierowca</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 min-w-[36px] bg-bakery-accent text-black font-bold rounded-full flex items-center justify-center text-sm shrink-0">
              {currentUser?.full_name ? currentUser.full_name.charAt(0).toUpperCase() : '…'}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold truncate">{currentUser?.full_name ?? 'Ładowanie...'}</span>
              <span className="text-[11px] text-gray-400">{getRoleLabel(currentRole)}</span>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            id="logout-button"
            className="flex items-center gap-2 text-xs text-gray-400 bg-none border-none border-t border-[#27272a] pt-2 mt-1 w-full text-left cursor-pointer transition-colors duration-150 hover:text-bakery-accent"
          >
            <LogOut size={14} />
            <span>Wyloguj</span>
          </button>
        </div>

      </aside>

      <main className="flex-1 h-full min-h-0 overflow-hidden bg-bakery-main">
        <DashboardListScrollbar
          className="dashboard-main-scrollbar h-full"
          contentClassName="min-h-full p-4 md:p-6 box-border"
          thumbTrackPadding={8}
        >
          <div className="w-full min-h-full">
            <Outlet context={{ currentRole }} />
          </div>
        </DashboardListScrollbar>
      </main>

    </div>
  );
};