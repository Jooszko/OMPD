import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import './DashboardLayout.css'; 

export const DashboardLayout: React.FC = () => {
  const location = useLocation();

  const menuItems = [
    { path: '/', label: 'Strona Główna' },
    { path: '/orders', label: 'Zamówienia' },
    { path: '/warehouse', label: 'Magazyn' },
    { path: '/logistics', label: 'Logistyka' },
    { path: '/recipes', label: 'Receptury' },
    { path: '/finance', label: 'Finanse' },
    { path: '/users', label: 'Użytkownicy' },
    { path: '/clients', label: 'Klienci' },
    { path: '/contractors', label: 'Kontrahenci' },
  ];

  return (
    <div className="app-container">
      
      <aside className="sidebar">
        
        <div className="sidebar-top">
          
          {/* LOGO BOX */}
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
            {menuItems.map((item) => {
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
          <div className="profile-info">
            <div className="profile-avatar">M</div>
            <div className="profile-details">
              <span className="profile-name">Mikołaj Klukowski</span>
              <span className="profile-status">Zalogowany</span>
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
          <Outlet />
        </div>
      </main>

    </div>
  );
};