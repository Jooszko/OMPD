import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useDashboard } from '../hooks/useDashboard';
import type { TodayOrder } from '../../../services/api';
import './HomeDashboard.css';

type UserRole = 'admin' | 'baker' | 'driver';

export const HomeDashboard: React.FC = () => {
  const [currentDateTime, setCurrentDateTime] = useState<string>('');
  const { currentRole } = useOutletContext<{ currentRole: UserRole }>();
  const { data, loading, error } = useDashboard();

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

  const getStatusLabel = (status: TodayOrder['status']) => {
    const labels: Record<TodayOrder['status'], string> = {
      planned: 'Zaplanowane',
      in_production: 'W produkcji',
      in_delivery: 'W dostawie',
      delivered: 'Dostarczone',
      cancelled: 'Anulowane',
    };
    return labels[status] ?? status;
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-header">
          <h1>Dzień dobry</h1>
          <div className="dashboard-date">{currentDateTime}</div>
        </div>
        <p style={{ padding: '2rem' }}>Ładowanie danych...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-header">
          <h1>Dzień dobry</h1>
          <div className="dashboard-date">{currentDateTime}</div>
        </div>
        <p style={{ padding: '2rem', color: 'red' }}>Błąd połączenia z serwerem: {error}</p>
      </div>
    );
  }

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
                  <span className="badge-count">Suma: {data?.today_orders.length ?? 0}</span>
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
                      {data?.today_orders.map((order, idx) => (
                        <tr key={idx}>
                          <td className="font-semibold">{order.client_name}</td>
                          <td className="text-center">{order.quantity} szt.</td>
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
                    {data?.total_items_for_shipment ?? 0} szt.
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
                        {data?.ingredients_used_today.map((ing, idx) => (
                          <tr key={idx}>
                            <td className="font-semibold">{ing.name}</td>
                            <td className="text-right font-mono font-bold">
                              {parseFloat(ing.total_amount).toFixed(2)} {ing.unit}
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
                  <span className="badge-count">Suma: {data?.revenue_per_client.length ?? 0}</span>
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
                      {data?.revenue_per_client.map((row, idx) => (
                        <tr key={idx}>
                          <td className="font-semibold">{row.client_name}</td>
                          <td className="text-right font-mono">{parseFloat(row.total_revenue).toFixed(2)} PLN</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="dashboard-card">
                {data?.financial_summary ? (
                  <>
                    <p className="card-subtitle">Przychód dzienny</p>
                    <p className="card-huge-number">{parseFloat(data.financial_summary.total_revenue).toFixed(2)} PLN</p>
                  </>
                ) : (
                  <p>Brak raportu finansowego na dziś</p>
                )}
              </div>

              <div className="dashboard-card">
                {data?.financial_summary ? (
                  <>
                    <p className="card-subtitle">Zysk netto</p>
                    <p className="card-huge-number">{parseFloat(data.financial_summary.net_profit).toFixed(2)} PLN</p>
                  </>
                ) : (
                  <p>Brak raportu finansowego na dziś</p>
                )}
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

              <div className="dashboard-card" style={{ gridColumn: 'span 3' }}>
                <div className="card-header-row">
                  <span>Składniki</span>
                  <span className="badge-count">Pozycji: {data?.warehouse_stock.length ?? 0}</span>
                </div>
                <div className="table-container">
                  <table className="orders-summary-table">
                    <thead>
                      <tr>
                        <th>Nazwa</th>
                        <th className="text-right">Stan obecny</th>
                        <th className="text-right">Min. stan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.warehouse_stock.map((item, idx) => (
                        <tr key={idx} className={parseFloat(item.current_stock) <= parseFloat(item.min_stock_level) ? 'row-warning' : ''}>
                          <td className="font-semibold">{item.name}</td>
                          <td className="text-right font-mono">{parseFloat(item.current_stock).toFixed(2)} {item.unit}</td>
                          <td className="text-right font-mono">{parseFloat(item.min_stock_level).toFixed(2)} {item.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
