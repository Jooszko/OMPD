import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useDashboard } from '../hooks/useDashboard';
import type { TodayOrder } from '../../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
      <div className="p-6 max-w-7xl mx-auto text-bakery-dark">
        <h1 className="text-2xl font-bold mb-2">Dzień dobry</h1>
        <p>Ładowanie danych...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto text-bakery-dark">
        <h1 className="text-2xl font-bold mb-2">Dzień dobry</h1>
        <p className="text-red-600">Błąd połączenia z serwerem: {error}</p>
      </div>
    );
  }

  return (

    <div className="w-full max-w-7xl mx-auto px-8 py-6 flex flex-col gap-5 text-bakery-dark">

      <div className="block">
        <h1 className="m-0 mb-1 text-2xl font-bold tracking-tight">Dzień dobry</h1>
        <div className="text-xs text-gray-500 font-medium">{currentDateTime}</div>
      </div>

      {(currentRole === 'admin' || currentRole === 'baker') && (
        <>
          <hr className="border-0 border-t border-bakery-border my-1" />
          <section className="flex flex-col gap-3">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 text-center mb-1">Dzisiejsze zamówienia</div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">

              <Card className="lg:col-span-2 bg-bakery-inactive border-bakery-btnBorder shadow-sm h-[320px] flex flex-col overflow-hidden">
                <CardHeader className="flex flex-row justify-between items-center py-2 px-4 border-b border-bakery-btnBorder space-y-0 shrink-0">
                  <CardTitle className="text-xs font-bold uppercase tracking-wide text-bakery-dark">Zamówienia</CardTitle>
                  <span className="bg-bakery-dark text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                    Suma: {data?.today_orders.length ?? 0}
                  </span>
                </CardHeader>
                <CardContent className="p-2 flex-1 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-bakery-inactive z-10">
                      <TableRow className="border-b border-bakery-btnBorder hover:bg-transparent">
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-bakery-dark h-8 px-3">Nazwa firmy</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-center text-bakery-dark h-8 px-3">Ilość produktów</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-center text-bakery-dark h-8 px-3">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.today_orders.map((order, idx) => (
                        <TableRow key={idx} className="bg-bakery-rowBg hover:bg-bakery-inactive border-b border-bakery-btnBorder transition-colors">
                          <TableCell className="py-2 px-3 text-sm font-semibold text-bakery-dark">{order.client_name}</TableCell>
                          <TableCell className="py-2 px-3 text-sm text-center text-bakery-dark">{order.quantity} szt.</TableCell>
                          <TableCell className="py-2 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              order.status === 'planned' ? 'bg-gray-300 text-gray-700' :
                              order.status === 'in_production' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                              order.status === 'in_delivery' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                              order.status === 'cancelled' ? 'bg-red-100 text-red-700 border border-red-200' :
                              'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}>
                              {getStatusLabel(order.status)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="flex flex-col gap-4 h-[320px]">

                <Card className="bg-bakery-inactive border-bakery-btnBorder py-3 px-4 flex flex-col items-center justify-center text-center shadow-sm shrink-0">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 font-bold">Łączna ilość do wysyłki</p>
                  <p className="text-2xl font-black text-blue-950 tracking-tight">
                    {data?.total_items_for_shipment ?? 0} <span className="text-lg font-bold">szt.</span>
                  </p>
                </Card>

                <Card className="bg-bakery-inactive border-bakery-btnBorder flex flex-col shadow-sm flex-1 overflow-hidden">
                  <CardHeader className="py-2 px-4 border-b border-bakery-btnBorder shrink-0">
                    <CardTitle className="text-xs font-bold uppercase tracking-wide text-gray-500">Dzisiejsze składniki</CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 flex-1 overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-bakery-inactive z-10">
                        <TableRow className="border-b border-bakery-btnBorder hover:bg-transparent">
                          <TableHead className="text-[10px] font-bold uppercase tracking-wider text-bakery-dark h-8 px-3">Składnik</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right text-bakery-dark h-8 px-3">Ilość</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.ingredients_used_today.map((ing, idx) => (
                          <TableRow key={idx} className="bg-bakery-rowBg hover:bg-bakery-inactive border-b border-bakery-btnBorder transition-colors">
                            <TableCell className="py-1.5 px-3 text-sm font-semibold text-bakery-dark">{ing.name}</TableCell>
                            <TableCell className="py-1.5 px-3 text-right font-mono text-sm font-bold text-bakery-dark">
                              {parseFloat(ing.total_amount).toFixed(2)} {ing.unit}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

              </div>

            </div>
          </section>
        </>
      )}

      {currentRole === 'admin' && (
        <>
          <hr className="border-0 border-t border-bakery-border my-1" />
          <section className="flex flex-col gap-3">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 text-center mb-1">Podsumowanie finansowe daily</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              <Card className="bg-bakery-inactive border-bakery-btnBorder shadow-sm h-[200px] flex flex-col overflow-hidden">
                <CardHeader className="flex flex-row justify-between items-center py-2 px-4 border-b border-bakery-btnBorder space-y-0 shrink-0">
                  <CardTitle className="text-xs font-bold uppercase tracking-wide text-bakery-dark">Wpływy per klient</CardTitle>
                </CardHeader>
                <CardContent className="p-2 flex-1 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-bakery-inactive z-10">
                      <TableRow className="border-b border-bakery-btnBorder hover:bg-transparent">
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-bakery-dark h-8 px-3">Nazwa firmy</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right text-bakery-dark h-8 px-3">Wartość</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.revenue_per_client.map((row, idx) => (
                        <TableRow key={idx} className="bg-bakery-rowBg hover:bg-bakery-inactive border-b border-bakery-btnBorder transition-colors">
                          <TableCell className="py-1.5 px-3 text-sm font-semibold text-bakery-dark">{row.client_name}</TableCell>
                          <TableCell className="py-1.5 px-3 text-right font-mono text-sm text-bakery-dark">{parseFloat(row.total_revenue).toFixed(2)} PLN</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="bg-bakery-inactive border-bakery-btnBorder h-[200px] p-4 flex flex-col items-center justify-center text-center shadow-sm">
                {data?.financial_summary ? (
                  <>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 font-bold">Przychód dzienny</p>
                    <p className="text-xl font-black text-bakery-dark tracking-tight">{parseFloat(data.financial_summary.total_revenue).toFixed(2)} PLN</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">Brak raportu finansowego</p>
                )}
              </Card>

              <Card className="bg-bakery-inactive border-bakery-btnBorder h-[200px] p-4 flex flex-col items-center justify-center text-center shadow-sm">
                {data?.financial_summary ? (
                  <>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 font-bold">Zysk netto</p>
                    <p className="text-xl font-black text-emerald-800 tracking-tight">{parseFloat(data.financial_summary.net_profit).toFixed(2)} PLN</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">Brak raportu finansowego</p>
                )}
              </Card>

            </div>
          </section>
        </>
      )}

      {(currentRole === 'admin' || currentRole === 'baker') && (
        <>
          <hr className="border-0 border-t border-bakery-border my-1" />
          <section className="flex flex-col gap-3">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 text-center mb-1">Podsumowanie stanów magazynowych</div>
            
            <Card className="bg-bakery-inactive border-bakery-btnBorder shadow-sm h-[240px] flex flex-col overflow-hidden">
              <CardHeader className="flex flex-row justify-between items-center py-2 px-4 border-b border-bakery-btnBorder space-y-0 shrink-0">
                <CardTitle className="text-xs font-bold uppercase tracking-wide text-bakery-dark">Składniki w magazynie</CardTitle>
                <span className="bg-bakery-dark text-white text-[10px] px-2 py-0.5 rounded-full font-bold">Pozycji: {data?.warehouse_stock.length ?? 0}</span>
              </CardHeader>
              <CardContent className="p-2 flex-1 overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-bakery-inactive z-10">
                    <TableRow className="border-b border-bakery-btnBorder hover:bg-transparent">
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-bakery-dark h-8 px-3">Nazwa</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right text-bakery-dark h-8 px-3">Stan obecny</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right text-bakery-dark h-8 px-3">Min. stan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.warehouse_stock.map((item, idx) => {
                      const isWarning = parseFloat(item.current_stock) <= parseFloat(item.min_stock_level);
                      return (
                        <TableRow key={idx} className="bg-bakery-rowBg hover:bg-bakery-inactive border-b border-bakery-btnBorder transition-colors">
                          <TableCell className={`py-1.5 px-3 text-sm font-semibold ${isWarning ? 'bg-red-50 text-red-900' : 'text-bakery-dark'}`}>{item.name}</TableCell>
                          <TableCell className={`py-1.5 px-3 text-right font-mono text-sm ${isWarning ? 'bg-red-50 text-red-900 font-bold' : 'text-bakery-dark'}`}>{parseFloat(item.current_stock).toFixed(2)} {item.unit}</TableCell>
                          <TableCell className={`py-1.5 px-3 text-right font-mono text-sm ${isWarning ? 'bg-red-50 text-red-900' : 'text-bakery-dark'}`}>{parseFloat(item.min_stock_level).toFixed(2)} {item.unit}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>
        </>
      )}

      {currentRole === 'driver' && (
        <>
          <hr className="border-0 border-t border-bakery-border my-1" />
          <section className="flex flex-col gap-3">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 text-center mb-1">Panel Logistyki Kierowcy</div>
            <Card className="bg-bakery-inactive border-bakery-btnBorder p-6 text-center shadow-sm">
              <p className="text-sm text-gray-600">Twoje dzisiejsze trasy i punkty wydań towaru znajdują się w sekcji "Logistyka".</p>
            </Card>
          </section>
        </>
      )}

    </div>
  );
};