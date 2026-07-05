import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';

type UserRole = 'admin' | 'baker' | 'driver';

export const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');

  const menuItems = [
    { path: '/', label: 'Strona Główna', roles: ['admin', 'baker', 'driver'] },
    { path: '/orders', label: 'Zamówienia', roles: ['admin'] },
    { path: '/warehouse', label: 'Magazyn', roles: ['admin', 'baker'] },
    { path: '/logistics', label: 'Logistyka', roles: ['admin', 'driver'] },
    { path: '/recipes', label: 'Receptury', roles: ['admin', 'baker'] },
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
    <div className="flex w-screen h-screen bg-bakery-main overflow-hidden font-sans select-none">
      
      <aside className="w-[240px] min-w-[240px] bg-bakery-main border-r border-bakery-border flex flex-col justify-between h-full box-border overflow-hidden">
        
        <div className="flex flex-col w-full min-h-0 flex-1">
          
          <div className="h-[120px] bg-bakery-dark p-4 flex items-center gap-3 border-b border-bakery-border box-border shrink-0">
            <div className="w-12 h-12 bg-bakery-accent rounded-xl flex items-center justify-center shadow-md box-border">
              <span className="text-white text-2xl font-bold">🍞</span>
            </div>
            <div className="flex flex-col text-white">
              <span className="font-bold text-lg leading-tight tracking-wide">Bakery Flow</span>
              <span className="text-xs text-gray-400 tracking-widest">ERP System</span>
            </div>
          </div>
          
          <nav className="flex flex-col gap-1.5 p-3 mt-2 overflow-y-auto flex-1 min-h-0 pr-1.5">
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
              {currentRole === 'admin' ? 'M' : currentRole === 'baker' ? 'P' : 'K'}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold truncate">Mikołaj Klukowski</span>
              <span className="text-[11px] text-gray-400">{getRoleLabel(currentRole)}</span>
            </div>
          </div>
          
          <button 
            onClick={() => console.log('Wylogowywanie...')}
            className="flex items-center gap-2 text-xs text-gray-400 bg-none border-none border-t border-[#27272a] pt-2 mt-1 w-full text-left cursor-pointer transition-colors duration-150 hover:text-bakery-accent"
          >
            <LogOut size={14} />
            <span>Wyloguj</span>
          </button>
        </div>

      </aside>

      <main className="flex-1 h-full overflow-x-hidden overflow-y-auto bg-bakery-main p-6 box-border">
        <div className="w-full h-full">
          <Outlet context={{ currentRole }} />
        </div>
      </main>

    </div>
  );
};