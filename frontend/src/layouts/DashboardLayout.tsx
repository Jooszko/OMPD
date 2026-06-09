import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import './DashboardLayout.css'; 

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
    <div className="app-container">
      
      <aside className="sidebar">
        
        <div className="sidebar-top">
          
          <div className="logo-box">
            <div className="logo-icon-container">
              <span className="logo-icon">🍞</span>
            </div>
            <div className="logo-text">
              <span className="logo-title">Bakery Flow</span>
              <span className="logo-subtitle">ERP System</span>
            </div>
          </div>
          
          <nav className="nav-container">
            {visibleMenuItems.map((item) => {
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`nav-link ${isActive ? 'nav-link-active' : 'nav-link-inactive'}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="profile-box">
          
          <div className="role-simulator">
            <label className="role-simulator-label">
              Widok roli:
            </label>
            <select 
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value as UserRole)}
              className="role-simulator-select"
            >
              <option value="admin">Właściciel</option>
              <option value="baker">Piekarz</option>
              <option value="driver">Kierowca</option>
            </select>
          </div>

          <div className="profile-info">
            <div className="profile-avatar">
              {currentRole === 'admin' ? 'M' : currentRole === 'baker' ? 'P' : 'K'}
            </div>
            <div className="profile-details">
              <span className="profile-name">Mikołaj Klukowski</span>
              <span className="profile-status">{getRoleLabel(currentRole)}</span>
            </div>
          </div>
          
          <button 
            onClick={() => console.log('Wylogowywanie...')}
            className="logout-button"
          >
            <LogOut size={14} />
            <span>Wyloguj</span>
          </button>
        </div>

      </aside>

      <main className="main-content">
        <div className="page-wrapper">
          <Outlet context={{ currentRole }} />
        </div>
      </main>

    </div>
  );
};