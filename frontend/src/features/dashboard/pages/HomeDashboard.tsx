import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import './HomeDashboard.css';

type UserRole = 'admin' | 'baker' | 'driver';

interface DailyOrderMock {
  id: number;
  clientName: string;
  totalQuantity: number; 
  totalValue: number;    
  status: 'planned' | 'in_production' | 'delivered';
}

interface DailyIngredientMock {
  id: number;
  name: string;
  amount: number;
  unit: 'kg' | 'l' | 'g';
}

const MOCK_DAILY_ORDERS: DailyOrderMock[] = [
  { id: 1, clientName: 'Biedronka - Skoczów', totalQuantity: 350, totalValue: 1225.00, status: 'in_production' },
  { id: 2, clientName: 'Społem Ustroń', totalQuantity: 120, totalValue: 480.00, status: 'planned' },
  { id: 3, clientName: 'Piekarnia lokalna "Ziarenko"', totalQuantity: 85, totalValue: 315.50, status: 'delivered' },
  { id: 4, clientName: 'Restauracja Pod Jelenie', totalQuantity: 45, totalValue: 210.00, status: 'in_production' },
];

const MOCK_DAILY_INGREDIENTS: DailyIngredientMock[] = [
  { id: 1, name: 'Mąka pszenna typu 550', amount: 250, unit: 'kg' },
  { id: 2, name: 'Woda', amount: 150, unit: 'l' },
  { id: 3, name: 'Drożdże świeże', amount: 7500, unit: 'g' },
  { id: 4, name: 'Sól', amount: 4.5, unit: 'kg' },
  { id: 4, name: 'Sól', amount: 4.5, unit: 'kg' },
  { id: 4, name: 'Sól', amount: 4.5, unit: 'kg' },
  { id: 4, name: 'Sól', amount: 4.5, unit: 'kg' },
  { id: 4, name: 'Sól', amount: 4.5, unit: 'kg' },
  { id: 4, name: 'Sól', amount: 4.5, unit: 'kg' },
  { id: 4, name: 'Sól', amount: 4.5, unit: 'kg' },
  { id: 4, name: 'Sól', amount: 4.5, unit: 'kg' },
  { id: 5, name: 'Mąka żytnia typu 720', amount: 60, unit: 'kg' },
];

export const HomeDashboard: React.FC = () => {
  const [currentDateTime, setCurrentDateTime] = useState<string>('');
  const { currentRole } = useOutletContext<{ currentRole: UserRole }>();

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setCurrentDateTime(now.toLocaleString('pl-PL', {
        dateStyle: 'long',
        timeStyle: 'medium'
      }));
    };
    
    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusLabel = (status: DailyOrderMock['status']) => {
    if (status === 'planned') return 'Zaplanowane';
    if (status === 'in_production') return 'W produkcji';
    if (status === 'delivered') return 'Dostarczone';
    return status;
  };

  return (
    <div className="dashboard-page">
      
      <div className="dashboard-header">
        <h1>Dzień dobry</h1>
        <div className="dashboard-date">{currentDateTime}</div>
      </div>

      {(currentRole === 'admin' || currentRole === 'baker') && (
        <>
          <hr className="dashboard-divider" />
          <section className="dashboard-section">
            <div className="dashboard-section-title">Dzisiejsze zamówienia</div>
            
            <div className="dashboard-flex-row">
              
              <div className="dashboard-card main-orders-card">
                <div className="card-header-row">
                  <span>Zamówienia</span>
                  <span className="badge-count">Suma: {MOCK_DAILY_ORDERS.length}</span>
                </div>
                
                <div className="table-container">
                  <table className="orders-summary-table">
                    <thead>
                      <tr>
                        <th>Nazwa firmy</th>
                        <th className="text-center">Ilość produktów</th>
                        <th className="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MOCK_DAILY_ORDERS.map((order) => (
                        <tr key={order.id}>
                          <td className="font-semibold">{order.clientName}</td>
                          <td className="text-center">{order.totalQuantity} szt.</td>
                          <td className="text-center">
                            <span className={`status-badge status-${order.status}`}>
                              {getStatusLabel(order.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="dashboard-side-column">
                
                <div className="dashboard-card side-metric-card">
                  <p className="card-subtitle">Łączna ilość produktów do wysyłki</p>
                  <p className="card-huge-number">
                    {MOCK_DAILY_ORDERS.reduce((sum, o) => sum + o.totalQuantity, 0)} szt.
                  </p>
                </div>
                
                <div className="dashboard-card side-ingredients-card">
                  <div className="card-header-row">
                    <span className="card-subtitle-static">Dzisiejsze wykorzystane składniki</span>
                  </div>
                  
                  <div className="table-container">
                    <table className="orders-summary-table">
                      <thead>
                        <tr>
                          <th>Składnik</th>
                          <th className="text-right">Ilość</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MOCK_DAILY_INGREDIENTS.map((ing) => (
                          <tr key={ing.id}>
                            <td className="font-semibold">{ing.name}</td>
                            <td className="text-right font-mono font-bold">
                              {ing.unit === 'g' ? ing.amount : ing.amount.toFixed(ing.amount % 1 === 0 ? 0 : 1)} {ing.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

            </div>
          </section>
        </>
      )}

      {currentRole === 'admin' && (
        <>
          <hr className="dashboard-divider" />
          <section className="dashboard-section">
            <div className="dashboard-section-title">Podsumowanie finansowe daily</div>
            <div className="dashboard-grid">
              
              <div className="dashboard-card main-orders-card-financial">
                <div className="card-header-row">
                  <span>Dzisiejsze wpływy</span>
                  <span className="badge-count">Suma: {MOCK_DAILY_ORDERS.length}</span>
                </div>
                <div className="table-container">
                  <table className="orders-summary-table">
                    <thead>
                      <tr>
                        <th>Nazwa firmy</th>
                        <th className="text-right">Wartość zamówienia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MOCK_DAILY_ORDERS.map((order) => (
                        <tr key={order.id}>
                          <td className="font-semibold">{order.clientName}</td>
                          <td className="text-right font-mono">{order.totalValue.toFixed(2)} PLN</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="dashboard-card">
                <p>Wartość produktów z sekcji wyżej wraz z sumą</p>
              </div>
              
              <div className="dashboard-card">
                <p>Wartość składników z sekcji wyżej wraz z sumą</p>
              </div>
              
            </div>
          </section>
        </>
      )}

      {(currentRole === 'admin' || currentRole === 'baker') && (
        <>
          <hr className="dashboard-divider" />
          <section className="dashboard-section">
            <div className="dashboard-section-title">Podsumowanie stanów magazynowych</div>
            <div className="dashboard-grid">
              
              <div className="dashboard-card">
                <p>Wykres zasobów na początek dnia (wykres słupkowy)</p>
                <div className="chart-placeholder">[Wykres Recharts]</div>
              </div>
              
              <div className="dashboard-card">
                <p>Wykres zasobów na koniec dnia po zrealizowaniu daily orders (wykres słupkowy)</p>
                <div className="chart-placeholder">[Wykres Recharts]</div>
              </div>
              
              <div className="dashboard-card">
                <p>Wartość składników z sekcji wyżej wraz z sumą</p>
              </div>
              
            </div>
          </section>
        </>
      )}

      {currentRole === 'driver' && (
        <>
          <hr className="dashboard-divider" />
          <section className="dashboard-section">
            <div className="dashboard-section-title">Panel Logistyki Kierowcy</div>
            <div className="dashboard-grid">
              <div className="dashboard-card" style={{ gridColumn: 'span 3' }}>
                <p>Twoje dzisiejsze trasy i punkty wydań towaru znajdują się w sekcji "Logistyka".</p>
              </div>
            </div>
          </section>
        </>
      )}

    </div>
  );
};