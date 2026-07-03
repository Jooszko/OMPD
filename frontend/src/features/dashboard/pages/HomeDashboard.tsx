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
    <div className="flex flex-col gap-6 text-bakery-dark w-full">

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

              {/* Tabela Zamówień oparta o shadcn */}
              <Card className="flex-[6.5] bg-bakery-inactive border-bakery-btnBorder shadow-sm box-border">
                <CardHeader className="flex flex-row justify-between items-center pb-2 border-b border-bakery-btnBorder space-y-0">
                  <CardTitle className="text-sm font-semibold text-bakery-dark">Zamówienia</CardTitle>
                  <span className="bg-bakery-dark text-white text-[11px] px-2 py-0.5 rounded-xl font-bold">
                    Suma: {data?.today_orders.length ?? 0}
                  </span>
                </CardHeader>
                <CardContent className="pt-4 p-4">
                  <div className="w-full overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-bakery-btnBorder hover:bg-transparent">
                          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-bakery-dark h-10 px-2">Nazwa firmy</TableHead>
                          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-center text-bakery-dark h-10 px-2">Ilość produktów</TableHead>
                          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-center text-bakery-dark h-10 px-2">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.today_orders.map((order, idx) => (
                          <TableRow key={idx} className="bg-bakery-rowBg hover:bg-bakery-inactive border-b border-bakery-btnBorder transition-colors">
                            <TableCell className="p-2 font-semibold text-bakery-dark">{order.client_name}</TableCell>
                            <TableCell className="p-2 text-center text-bakery-dark">{order.quantity} szt.</TableCell>
                            <TableCell className="p-2 text-center">
                              <span className={`inline-block px-2 py-1 rounded text-[11px] font-bold uppercase ${
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
                  </div>
                </CardContent>
              </Card>

              <div className="flex-[3.5] flex flex-col gap-5">

                {/* Karta Metryki ilości produktów */}
                <Card className="bg-bakery-inactive border-bakery-btnBorder p-3 min-h-[90px] flex flex-col items-center justify-center text-center shadow-sm box-border">
                  <p className="text-sm text-gray-600 mb-1.5 font-semibold">Łączna ilość produktów do wysyłki</p>
                  <p className="text-3xl font-bold text-blue-950 m-0">
                    {data?.total_items_for_shipment ?? 0} szt.
                  </p>
                </Card>

                {/* Karta Składników oparta o shadcn z zachowanym scrollem */}
                <Card className="bg-bakery-inactive border-bakery-btnBorder flex flex-col justify-start shadow-sm box-border flex-1">
                  <CardHeader className="pb-2 border-b border-bakery-btnBorder">
                    <CardTitle className="text-sm text-gray-600 font-semibold">Dzisiejsze wykorzystane składniki</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 p-4 flex-1">
                    <div className="w-full max-h-[140px] overflow-y-auto overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b border-bakery-btnBorder hover:bg-transparent">
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-bakery-dark h-10 px-2">Składnik</TableHead>
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right text-bakery-dark h-10 px-2">Ilość</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data?.ingredients_used_today.map((ing, idx) => (
                            <TableRow key={idx} className="bg-bakery-rowBg hover:bg-bakery-inactive border-b border-bakery-btnBorder transition-colors">
                              <TableCell className="p-2 font-semibold text-bakery-dark">{ing.name}</TableCell>
                              <TableCell className="p-2 text-right font-mono font-bold text-bakery-dark">
                                {parseFloat(ing.total_amount).toFixed(2)} {ing.unit}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

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

              {/* Finanse: wpływy */}
              <Card className="bg-bakery-inactive border-bakery-btnBorder shadow-sm box-border">
                <CardHeader className="flex flex-row justify-between items-center pb-2 border-b border-bakery-btnBorder space-y-0">
                  <CardTitle className="text-sm font-semibold text-bakery-dark">Dzisiejsze wpływy</CardTitle>
                  <span className="bg-bakery-dark text-white text-[11px] px-2 py-0.5 rounded-xl font-bold">
                    Suma: {data?.revenue_per_client.length ?? 0}
                  </span>
                </CardHeader>
                <CardContent className="pt-4 p-4">
                  <div className="w-full overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-bakery-btnBorder hover:bg-transparent">
                          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-bakery-dark h-10 px-2">Nazwa firmy</TableHead>
                          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right text-bakery-dark h-10 px-2">Wartość</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.revenue_per_client.map((row, idx) => (
                          <TableRow key={idx} className="bg-bakery-rowBg hover:bg-bakery-inactive border-b border-bakery-btnBorder transition-colors">
                            <TableCell className="p-2 font-semibold text-bakery-dark">{row.client_name}</TableCell>
                            <TableCell className="p-2 text-right font-mono text-bakery-dark">{parseFloat(row.total_revenue).toFixed(2)} PLN</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-bakery-inactive border-bakery-btnBorder min-h-[180px] p-5 flex flex-col items-center justify-center text-center shadow-sm box-border">
                {data?.financial_summary ? (
                  <>
                    <p className="text-sm text-gray-600 mb-2 font-semibold">Przychód dzienny</p>
                    <p className="text-2xl font-bold text-bakery-dark m-0">{parseFloat(data.financial_summary.total_revenue).toFixed(2)} PLN</p>
                  </>
                ) : (
                  <p className="m-0 text-gray-800 leading-balanced">Brak raportu finansowego na dziś</p>
                )}
              </Card>

              <Card className="bg-bakery-inactive border-bakery-btnBorder min-h-[180px] p-5 flex flex-col items-center justify-center text-center shadow-sm box-border">
                {data?.financial_summary ? (
                  <>
                    <p className="text-sm text-gray-600 mb-2 font-semibold">Zysk netto</p>
                    <p className="text-2xl font-bold text-bakery-dark m-0">{parseFloat(data.financial_summary.net_profit).toFixed(2)} PLN</p>
                  </>
                ) : (
                  <p className="m-0 text-gray-800 leading-balanced">Brak raportu finansowego na dziś</p>
                )}
              </Card>

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

              {/* Magazyn oparty o shadcn */}
              <Card className="bg-bakery-inactive border-bakery-btnBorder shadow-sm box-border col-span-3">
                <CardHeader className="flex flex-row justify-between items-center pb-2 border-b border-bakery-btnBorder space-y-0">
                  <CardTitle className="text-sm font-semibold text-bakery-dark">Składniki</CardTitle>
                  <span className="bg-bakery-dark text-white text-[11px] px-2 py-0.5 rounded-xl font-bold">Pozycji: {data?.warehouse_stock.length ?? 0}</span>
                </CardHeader>
                <CardContent className="pt-4 p-4">
                  <div className="w-full overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-bakery-btnBorder hover:bg-transparent">
                          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-bakery-dark h-10 px-2">Nazwa</TableHead>
                          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right text-bakery-dark h-10 px-2">Stan obecny</TableHead>
                          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right text-bakery-dark h-10 px-2">Min. stan</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.warehouse_stock.map((item, idx) => {
                          const isWarning = parseFloat(item.current_stock) <= parseFloat(item.min_stock_level);
                          return (
                            <TableRow key={idx} className="bg-bakery-rowBg hover:bg-bakery-inactive border-b border-bakery-btnBorder transition-colors">
                              <TableCell className={`p-2 font-semibold group-hover:bg-bakery-inactive ${isWarning ? 'bg-red-100 text-red-900' : 'text-bakery-dark'}`}>{item.name}</TableCell>
                              <TableCell className={`p-2 text-right font-mono group-hover:bg-bakery-inactive ${isWarning ? 'bg-red-100 text-red-900 font-bold' : 'text-bakery-dark'}`}>{parseFloat(item.current_stock).toFixed(2)} {item.unit}</TableCell>
                              <TableCell className={`p-2 text-right font-mono group-hover:bg-bakery-inactive ${isWarning ? 'bg-red-100 text-red-900' : 'text-bakery-dark'}`}>{parseFloat(item.min_stock_level).toFixed(2)} {item.unit}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

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
              <Card className="bg-bakery-inactive border-bakery-btnBorder min-h-[180px] p-5 flex flex-col items-center justify-center text-center shadow-sm box-border col-span-3">
                <p className="m-0 text-gray-800 leading-balanced">Twoje dzisiejsze trasy i punkty wydań towaru znajdują się w sekcji "Logistyka".</p>
              </Card>
            </div>
          </section>
        </>
      )}

    </div>
  );
};