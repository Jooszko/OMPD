import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useDashboard } from '../hooks/useDashboard';
import type { TodayOrder } from '../../../services/api';

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
      <div className="flex flex-col gap-6 text-bakery-dark">
        <div className="block">
          <h1 className="m-0 mb-2 text-2xl font-bold">Dzień dobry</h1>
          <div className="text-sm text-gray-600">{currentDateTime}</div>
        </div>
        <p className="p-8">Ładowanie danych...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6 text-bakery-dark">
        <div className="block">
          <h1 className="m-0 mb-2 text-2xl font-bold">Dzień dobry</h1>
          <div className="text-sm text-gray-600">{currentDateTime}</div>
        </div>
        <p className="p-8 text-red-600">Błąd połączenia z serwerem: {error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-bakery-dark">

      <div className="block">
        <h1 className="m-0 mb-2 text-2xl font-bold">Dzień dobry</h1>
        <div className="text-sm text-gray-600">{currentDateTime}</div>
      </div>

      {(currentRole === 'admin' || currentRole === 'baker') && (
        <>
          <hr className="border-0 border-t border-bakery-border my-3" />
          <section className="flex flex-col gap-4">
            <div className="text-sm font-semibold text-center text-gray-700 mb-1">Dzisiejsze zamówienia</div>

            <div className="flex gap-5 w-full">

              <div className="flex-[6.5] bg-bakery-inactive border border-bakery-btnBorder rounded-md p-4 min-h-[220px] flex flex-col shadow-sm box-border">
                <div className="flex justify-between items-center mb-[14px] pb-2 border-b border-bakery-btnBorder font-semibold text-sm box-border">
                  <span>Zamówienia</span>
                  <span className="bg-bakery-dark text-white text-[11px] px-2 py-0.5 rounded-xl font-bold">Suma: {data?.today_orders.length ?? 0}</span>
                </div>

                <div className="w-full overflow-x-auto">
                  <table className="w-full border-collapse text-sm text-left">
                    <thead>
                      <tr>
                        <th className="bg-bakery-btnBorder text-bakery-dark p-2 text-[11px] font-semibold uppercase tracking-wider">Nazwa firmy</th>
                        <th className="bg-bakery-btnBorder text-bakery-dark p-2 text-[11px] font-semibold uppercase tracking-wider text-center">Ilość produktów</th>
                        <th className="bg-bakery-btnBorder text-bakery-dark p-2 text-[11px] font-semibold uppercase tracking-wider text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.today_orders.map((order, idx) => (
                        <tr key={idx} className="group">
                          <td className="p-2 border-b border-bakery-btnBorder bg-bakery-rowBg font-semibold group-hover:bg-bakery-inactive">{order.client_name}</td>
                          <td className="p-2 border-b border-bakery-btnBorder bg-bakery-rowBg text-center group-hover:bg-bakery-inactive">{order.quantity} szt.</td>
                          <td className="p-2 border-b border-bakery-btnBorder bg-bakery-rowBg text-center group-hover:bg-bakery-inactive">
                            <span className={`inline-block px-2 py-1 rounded text-[11px] font-bold uppercase ${
                              order.status === 'planned' ? 'bg-gray-300 text-gray-700' :
                              order.status === 'in_production' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                              order.status === 'in_delivery' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                              order.status === 'cancelled' ? 'bg-red-100 text-red-700 border border-red-200' :
                              'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}>
                              {getStatusLabel(order.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex-[3.5] flex flex-col gap-5">

                <div className="bg-bakery-inactive border border-bakery-btnBorder rounded-md p-3 min-h-[90px] flex flex-col items-center justify-center text-center shadow-sm box-border">
                  <p className="text-sm text-gray-600 mb-1.5 font-semibold">Łączna ilość produktów do wysyłki</p>
                  <p className="text-3xl font-bold text-blue-900 m-0">
                    {data?.total_items_for_shipment ?? 0} szt.
                  </p>
                </div>

                <div className="bg-bakery-inactive border border-bakery-btnBorder rounded-md p-4 flex flex-col justify-start shadow-sm box-border flex-1">
                  <div className="flex justify-between items-center mb-[14px] pb-2 border-b border-bakery-btnBorder font-semibold text-sm box-border">
                    <span className="text-sm text-gray-600 font-semibold">Dzisiejsze wykorzystane składniki</span>
                  </div>

                  <div className="w-full overflow-x-auto max-h-[140px] overflow-y-auto">
                    <table className="w-full border-collapse text-sm text-left">
                      <thead>
                        <tr>
                          <th className="bg-bakery-btnBorder text-bakery-dark p-2 text-[11px] font-semibold uppercase tracking-wider">Składnik</th>
                          <th className="bg-bakery-btnBorder text-bakery-dark p-2 text-[11px] font-semibold uppercase tracking-wider text-right">Ilość</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data?.ingredients_used_today.map((ing, idx) => (
                          <tr key={idx} className="group">
                            <td className="p-2 border-b border-bakery-btnBorder bg-bakery-rowBg font-semibold group-hover:bg-bakery-inactive">{ing.name}</td>
                            <td className="p-2 border-b border-bakery-btnBorder bg-bakery-rowBg text-right font-mono font-bold group-hover:bg-bakery-inactive">
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
          <hr className="border-0 border-t border-bakery-border my-3" />
          <section className="flex flex-col gap-4">
            <div className="text-sm font-semibold text-center text-gray-700 mb-1">Podsumowanie finansowe daily</div>
            <div className="grid grid-cols-3 gap-5">

              <div className="bg-bakery-inactive border border-bakery-btnBorder rounded-md p-4 flex flex-col justify-start shadow-sm box-border">
                <div className="flex justify-between items-center mb-[14px] pb-2 border-b border-bakery-btnBorder font-semibold text-sm box-border">
                  <span>Dzisiejsze wpływy</span>
                  <span className="bg-bakery-dark text-white text-[11px] px-2 py-0.5 rounded-xl font-bold">Suma: {data?.revenue_per_client.length ?? 0}</span>
                </div>
                <div className="w-full overflow-x-auto">
                  <table className="w-full border-collapse text-sm text-left">
                    <thead>
                      <tr>
                        <th className="bg-bakery-btnBorder text-bakery-dark p-2 text-[11px] font-semibold uppercase tracking-wider">Nazwa firmy</th>
                        <th className="bg-bakery-btnBorder text-bakery-dark p-2 text-[11px] font-semibold uppercase tracking-wider text-right">Wartość zamówienia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.revenue_per_client.map((row, idx) => (
                        <tr key={idx} className="group">
                          <td className="p-2 border-b border-bakery-btnBorder bg-bakery-rowBg font-semibold group-hover:bg-bakery-inactive">{row.client_name}</td>
                          <td className="p-2 border-b border-bakery-btnBorder bg-bakery-rowBg text-right font-mono group-hover:bg-bakery-inactive">{parseFloat(row.total_revenue).toFixed(2)} PLN</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-bakery-inactive border border-bakery-btnBorder rounded-md min-h-[180px] p-5 flex flex-col items-center justify-center text-center shadow-sm box-border">
                {data?.financial_summary ? (
                  <>
                    <p className="text-sm text-gray-600 mb-2 font-semibold">Przychód dzienny</p>
                    <p className="text-2xl font-bold text-bakery-dark m-0">{parseFloat(data.financial_summary.total_revenue).toFixed(2)} PLN</p>
                  </>
                ) : (
                  <p className="m-0 text-gray-800 leading-balanced">Brak raportu finansowego na dziś</p>
                )}
              </div>

              <div className="bg-bakery-inactive border border-bakery-btnBorder rounded-md min-h-[180px] p-5 flex flex-col items-center justify-center text-center shadow-sm box-border">
                {data?.financial_summary ? (
                  <>
                    <p className="text-sm text-gray-600 mb-2 font-semibold">Zysk netto</p>
                    <p className="text-2xl font-bold text-bakery-dark m-0">{parseFloat(data.financial_summary.net_profit).toFixed(2)} PLN</p>
                  </>
                ) : (
                  <p className="m-0 text-gray-800 leading-balanced">Brak raportu finansowego na dziś</p>
                )}
              </div>

            </div>
          </section>
        </>
      )}

      {(currentRole === 'admin' || currentRole === 'baker') && (
        <>
          <hr className="border-0 border-t border-bakery-border my-3" />
          <section className="flex flex-col gap-4">
            <div className="text-sm font-semibold text-center text-gray-700 mb-1">Podsumowanie stanów magazynowych</div>
            <div className="grid grid-cols-3 gap-5">

              <div className="bg-bakery-inactive border border-bakery-btnBorder rounded-md p-4 flex flex-col justify-start shadow-sm box-border col-span-3">
                <div className="flex justify-between items-center mb-[14px] pb-2 border-b border-bakery-btnBorder font-semibold text-sm box-border">
                  <span>Składniki</span>
                  <span className="bg-bakery-dark text-white text-[11px] px-2 py-0.5 rounded-xl font-bold">Pozycji: {data?.warehouse_stock.length ?? 0}</span>
                </div>
                <div className="w-full overflow-x-auto">
                  <table className="w-full border-collapse text-sm text-left">
                    <thead>
                      <tr>
                        <th className="bg-bakery-btnBorder text-bakery-dark p-2 text-[11px] font-semibold uppercase tracking-wider">Nazwa</th>
                        <th className="bg-bakery-btnBorder text-bakery-dark p-2 text-[11px] font-semibold uppercase tracking-wider text-right">Stan obecny</th>
                        <th className="bg-bakery-btnBorder text-bakery-dark p-2 text-[11px] font-semibold uppercase tracking-wider text-right">Min. stan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.warehouse_stock.map((item, idx) => {
                        const isWarning = parseFloat(item.current_stock) <= parseFloat(item.min_stock_level);
                        return (
                          <tr key={idx} className="group">
                            <td className={`p-2 border-b border-bakery-btnBorder font-semibold group-hover:bg-bakery-inactive ${isWarning ? 'bg-red-100 text-red-900' : 'bg-bakery-rowBg'}`}>{item.name}</td>
                            <td className={`p-2 border-b border-bakery-btnBorder text-right font-mono group-hover:bg-bakery-inactive ${isWarning ? 'bg-red-100 text-red-900 font-bold' : 'bg-bakery-rowBg'}`}>{parseFloat(item.current_stock).toFixed(2)} {item.unit}</td>
                            <td className={`p-2 border-b border-bakery-btnBorder text-right font-mono group-hover:bg-bakery-inactive ${isWarning ? 'bg-red-100 text-red-900' : 'bg-bakery-rowBg'}`}>{parseFloat(item.min_stock_level).toFixed(2)} {item.unit}</td>
                          </tr>
                        );
                      })}
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
          <hr className="border-0 border-t border-bakery-border my-3" />
          <section className="flex flex-col gap-4">
            <div className="text-sm font-semibold text-center text-gray-700 mb-1">Panel Logistyki Kierowcy</div>
            <div className="grid grid-cols-3 gap-5">
              <div className="bg-bakery-inactive border border-bakery-btnBorder rounded-md min-h-[180px] p-5 flex flex-col items-center justify-center text-center shadow-sm box-border col-span-3">
                <p className="m-0 text-gray-800 leading-balanced">Twoje dzisiejsze trasy i punkty wydań towaru znajdują się w sekcji "Logistyka".</p>
              </div>
            </div>
          </section>
        </>
      )}

    </div>
  );
};