import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { NotificationBell } from '../features/dashboard/components/NotificationBell';
import { logoutUser, fetchCurrentUser, type AppUser } from '../services/api';
import { clearQueue, loadQueue, syncQueue } from '../services/actionQueue';

type UserRole = 'admin' | 'baker' | 'driver';

export const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetchCurrentUser()
      .then((user) => {
        setCurrentUser(user);
        setCurrentRole(user.role);
      })
      .catch((err) => console.error('Błąd podczas ładowania danych konta:', err));
  }, []);

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
    logoutUser();
    navigate('/login', { replace: true });
  };

  const menuItems = [
    { path: '/', label: 'Strona Główna', roles: ['admin', 'baker'] },
    { path: '/orders', label: 'Zamówienia', roles: ['admin', 'baker'] },
    { path: '/warehouse', label: 'Magazyn', roles: ['admin', 'baker'] },
    { path: '/logistics', label: 'Logistyka', roles: ['admin', 'driver'] },
    { path: '/products', label: 'Produkty', roles: ['admin', 'baker'] },
    { path: '/finance', label: 'Finanse', roles: ['admin'] },
    { path: '/users', label: 'Użytkownicy', roles: ['admin'] },
    { path: '/clients', label: 'Klienci', roles: ['admin'] },
    { path: '/contractors', label: 'Kontrahenci', roles: ['admin'] },
  ];

  const visibleMenuItems = menuItems.filter(item => item.roles.includes(currentRole));

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
          <nav className="flex flex-col gap-1.5 p-3 mt-2 overflow-y-auto flex-1 min-h-0 pr-1.5">
            <NotificationBell />
            <hr className="border-0 border-t border-bakery-border my-1 shrink-0" />

            {visibleMenuItems.map((item) => {
              const isActive = location.pathname === item.path;
              
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
          </nav>
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
            className="flex items-center gap-2 text-xs text-gray-400 bg-none border-none border-t border-[#27272a] pt-2 mt-1 w-full text-left cursor-pointer transition-colors duration-150 hover:text-bakery-accent"
          >
            <LogOut size={14} />
            <span>Wyloguj</span>
          </button>
        </div>

      </aside>

      <main className="flex-1 h-full overflow-x-hidden overflow-y-auto bg-bakery-main p-4 md:p-6 box-border">
        <div className="w-full h-full">
          <Outlet context={{ currentRole }} />
        </div>
      </main>

    </div>
  );
};