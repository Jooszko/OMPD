import { useEffect, useState } from 'react';
import { Search, Plus, Edit, Trash2, Calendar, RefreshCw, Clock, Eye } from 'lucide-react';

import { type Order, type OrderItem } from '../types';
import { fetchDailyOrders, fetchStandingOrders, fetchOrderHistory } from '../../../services/api';

const STATUS_LABELS: Record<string, string> = {
  planned: 'Zaplanowane',
  in_production: 'W produkcji',
  in_delivery: 'W dostawie',
  delivered: 'Dostarczone',
  cancelled: 'Anulowane',
};

export default function ZamowieniaPanel() {
  const [activeTab, setActiveTab] = useState<'dzisiejsze' | 'stale' | 'historia'>('dzisiejsze');
  const [selectedOrderId, setSelectedOrderId] = useState<string | number | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');

  const [dailyOrders, setDailyOrders] = useState<Order[]>([]);
  const [standingOrders, setStandingOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [daily, standing, history] = await Promise.all([
          fetchDailyOrders(),
          fetchStandingOrders(),
          fetchOrderHistory(),
        ]);
        setDailyOrders(daily);
        setStandingOrders(standing);
        setHistoryOrders(history);
      } catch (error) {
        console.error('Błąd podczas ładowania zamówień:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleRowClick = (order: Order) => {
    setViewingOrder(order);
  };

  const dailyProductionSummary = dailyOrders
    .flatMap((o) => o.items ?? [])
    .reduce<Record<string, number>>((acc, item) => {
      const key = item.product_name ?? String(item.product_id);
      acc[key] = (acc[key] ?? 0) + item.qty;
      return acc;
    }, {});

  const filteredHistory = historyOrders
    .filter((o) => (o.client_name ?? '').toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'amount') return a.total_amount - b.total_amount;
      return (b.date ?? '').localeCompare(a.date ?? '');
    });

  return (
    <div className="w-full max-w-7xl mx-auto px-8 py-6 flex flex-col gap-5 text-bakery-dark">

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="m-0 mb-1 text-2xl font-bold tracking-tight text-bakery-dark">Zarządzanie Zamówieniami</h1>
          <p className="text-xs text-gray-500 font-medium">Moduł obsługi zamówień bieżących, harmonogramów stałych i archiwum.</p>
        </div>

        <div className="flex bg-bakery-inactive p-1 rounded border border-bakery-btnBorder shadow-sm">
          <button
            onClick={() => { setActiveTab('dzisiejsze'); setSelectedOrderId(null); setViewingOrder(null); }}
            className={`px-4 py-1.5 text-xs font-semibold rounded transition-all ${activeTab === 'dzisiejsze' ? 'bg-bakery-dark text-white shadow-xs' : 'text-bakery-dark hover:bg-bakery-rowBg'}`}
          >
            <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> Dzisiejsze</div>
          </button>
          <button
            onClick={() => { setActiveTab('stale'); setSelectedOrderId(null); setViewingOrder(null); }}
            className={`px-4 py-1.5 text-xs font-semibold rounded transition-all ${activeTab === 'stale' ? 'bg-bakery-dark text-white shadow-xs' : 'text-bakery-dark hover:bg-bakery-rowBg'}`}
          >
            <div className="flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5" /> Stałe</div>
          </button>
          <button
            onClick={() => { setActiveTab('historia'); setSelectedOrderId(null); setViewingOrder(null); }}
            className={`px-4 py-1.5 text-xs font-semibold rounded transition-all ${activeTab === 'historia' ? 'bg-bakery-dark text-white shadow-xs' : 'text-bakery-dark hover:bg-bakery-rowBg'}`}
          >
            <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Historia</div>
          </button>
        </div>
      </div>

      {activeTab === 'dzisiejsze' && (
        <>
          <hr className="border-0 border-t border-bakery-border my-1" />
          <div className="bg-bakery-inactive border border-bakery-btnBorder p-4 rounded shadow-sm">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              Sumaryczna produkcja na dziś (Zbiorówka wypieku):
            </h3>
            {Object.keys(dailyProductionSummary).length === 0 ? (
              <p className="text-xs text-gray-500 italic font-semibold">Brak zamówień na dziś.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-sm text-bakery-dark font-medium">
                {Object.entries(dailyProductionSummary).map(([productName, qty]) => (
                  <div key={productName} className="bg-bakery-rowBg p-2.5 rounded border border-bakery-btnBorder font-semibold">
                    {productName}: <span className="font-bold text-base text-blue-950">{qty} szt.</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <hr className="border-0 border-t border-bakery-border my-1" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start w-full">

        <div className="lg:col-span-2 flex flex-col gap-4">

          {activeTab === 'historia' && (
            <div className="flex gap-2 bg-bakery-inactive p-2 rounded border border-bakery-btnBorder shadow-sm">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-bakery-border w-4 h-4" />
                <input
                  type="text"
                  placeholder="Szukaj po nazwie klienta..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 border border-bakery-btnBorder rounded text-xs bg-bakery-rowBg focus:bg-white text-bakery-dark font-semibold outline-none focus:border-bakery-accent"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-semibold rounded text-xs px-3 outline-none cursor-pointer focus:border-bakery-accent"
              >
                <option value="date">Sortuj: Data najnowsza</option>
                <option value="amount">Sortuj: Kwota rosnąco</option>
              </select>
            </div>
          )}

          <div className="bg-bakery-inactive rounded border border-bakery-btnBorder shadow-sm h-[400px] flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-2 relative">
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500 font-semibold">Ładowanie danych z bazy...</div>
              ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-bakery-inactive z-10">
                  <tr className="border-b border-bakery-btnBorder text-[10px] font-bold text-bakery-dark uppercase tracking-wider">
                    <th className="py-2 px-3 w-12 text-center h-8">Wybór</th>
                    {activeTab === 'historia' && <th className="py-2 px-3 h-8">Data</th>}
                    <th className="py-2 px-3 h-8">Nazwa firmy</th>
                    {activeTab === 'stale' ? <th className="py-2 px-3 h-8">Dni tygodnia</th> : <th className="py-2 px-3 h-8 text-center">Status</th>}
                    <th className="py-2 px-3 text-center h-8">Ilość produktów</th>
                    <th className="py-2 px-3 text-right h-8">Wartość</th>
                    <th className="py-2 px-3 text-center h-8">Akcja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bakery-btnBorder text-sm">

                  {activeTab === 'dzisiejsze' && dailyOrders.map((order) => (
                    <tr key={order.id} className={`bg-bakery-rowBg hover:bg-bakery-inactive transition border-b border-bakery-btnBorder ${selectedOrderId === order.id ? 'bg-[#c9c3c3]' : ''}`}>
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedOrderId === order.id}
                          onChange={() => setSelectedOrderId(selectedOrderId === order.id ? null : order.id)}
                          className="rounded border-bakery-border text-bakery-dark focus:ring-bakery-accent w-4 h-4 accent-bakery-dark cursor-pointer"
                        />
                      </td>
                      <td className="py-2 px-3 font-semibold text-bakery-dark">
                        {order.client_name}
                        <span className="block text-[11px] text-gray-500 font-medium">{order.address}</span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex gap-1.5 items-center justify-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${order.is_standing ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-300 text-gray-700'}`}>
                            {order.is_standing ? 'Stałe' : 'Jednorazowe'}
                          </span>
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-700 border border-amber-200">{STATUS_LABELS[order.status ?? ''] ?? order.status}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center font-semibold text-bakery-dark">{order.total_quantity} szt.</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-bakery-dark">{order.total_amount.toFixed(2)} PLN</td>
                      <td className="py-2 px-3 text-center">
                        <button onClick={() => handleRowClick(order)} className="text-bakery-dark hover:text-white p-1 rounded bg-bakery-inactive hover:bg-bakery-dark border border-bakery-btnBorder inline-flex items-center gap-1 text-[11px] font-bold transition-all shadow-2xs">
                          <Eye className="w-3.5 h-3.5" /> Szczegóły
                        </button>
                      </td>
                    </tr>
                  ))}

                  {activeTab === 'stale' && standingOrders.map((order) => (
                    <tr key={order.id} className={`bg-bakery-rowBg hover:bg-bakery-inactive transition border-b border-bakery-btnBorder ${selectedOrderId === order.id ? 'bg-[#c9c3c3]' : ''}`}>
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedOrderId === order.id}
                          onChange={() => setSelectedOrderId(selectedOrderId === order.id ? null : order.id)}
                          className="rounded border-bakery-border text-bakery-dark focus:ring-bakery-accent w-4 h-4 accent-bakery-dark cursor-pointer"
                        />
                      </td>
                      <td className="py-2 px-3 font-semibold text-bakery-dark">
                        {order.client_name}
                      </td>
                      <td className="py-2 px-3 text-bakery-dark text-xs font-semibold italic">{order.day_of_week}</td>
                      <td className="py-2 px-3 text-center font-semibold text-bakery-dark">{order.total_quantity} szt.</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-bakery-dark">{order.total_amount.toFixed(2)} PLN</td>
                      <td className="py-2 px-3 text-center">
                        <button onClick={() => handleRowClick(order)} className="text-bakery-dark hover:text-white p-1 rounded bg-bakery-inactive hover:bg-bakery-dark border border-bakery-btnBorder inline-flex items-center gap-1 text-[11px] font-bold transition-all shadow-2xs">
                          <Eye className="w-3.5 h-3.5" /> Szczegóły
                        </button>
                      </td>
                    </tr>
                  ))}

                  {activeTab === 'historia' && filteredHistory.map((order) => (
                    <tr key={order.id} className="bg-bakery-rowBg hover:bg-bakery-inactive transition border-b border-bakery-btnBorder">
                      <td className="py-2 px-3 text-center text-gray-400 font-bold">-</td>
                      <td className="py-2 px-3 text-bakery-dark font-mono text-xs font-bold">{order.date}</td>
                      <td className="py-2 px-3 font-semibold text-bakery-dark">
                        {order.client_name}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${order.status === 'cancelled' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>{STATUS_LABELS[order.status ?? ''] ?? order.status}</span>
                      </td>
                      <td className="py-2 px-3 text-center font-semibold text-bakery-dark">{order.total_quantity} szt.</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-bakery-dark">{order.total_amount.toFixed(2)} PLN</td>
                      <td className="py-2 px-3 text-center">
                        <button onClick={() => handleRowClick(order)} className="text-bakery-dark hover:text-white p-1 rounded bg-bakery-inactive hover:bg-bakery-dark border border-bakery-btnBorder inline-flex items-center gap-1 text-[11px] font-bold transition-all shadow-2xs">
                          <Eye className="w-3.5 h-3.5" /> Szczegóły
                        </button>
                      </td>
                    </tr>
                  ))}

                </tbody>
              </table>
              )}
            </div>
          </div>

          {activeTab !== 'historia' && (
            <div className="flex gap-2 items-center bg-bakery-inactive p-3 rounded border border-bakery-btnBorder shadow-sm">
              <button className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded transition shadow-xs active:scale-[0.98]">
                <Plus className="w-4 h-4 text-bakery-accent" /> Dodaj {activeTab === 'dzisiejsze' ? 'jednorazowe' : 'stałe'}
              </button>

              <button
                disabled={!selectedOrderId}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-bakery-rowBg border border-bakery-btnBorder text-bakery-dark rounded shadow-2xs hover:bg-[#dcd8d8] disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.98]"
              >
                <Edit className="w-4 h-4" /> Edytuj
              </button>

              <button
                disabled={!selectedOrderId}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-red-50 border border-red-200 text-red-700 rounded shadow-2xs hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.98]"
              >
                <Trash2 className="w-4 h-4" /> Usuń
              </button>

              {!selectedOrderId && (
                <span className="text-[10px] text-gray-500 font-semibold ml-2 italic">Zaznacz jedno zamówienie na tabeli, aby je edytować lub usunąć.</span>
              )}
            </div>
          )}
        </div>

        <div className="bg-bakery-inactive rounded border border-bakery-btnBorder shadow-sm p-4 flex flex-col h-[460px] overflow-hidden">
          <div className="border-b border-bakery-btnBorder pb-3 shrink-0">
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">Podgląd Szczegółów</h2>
            <p className="text-[11px] text-gray-500 font-medium">Kliknij „Szczegóły” w tabeli, by zobaczyć skład pozycji.</p>
          </div>

          <div className="flex-1 overflow-y-auto mt-4 pr-1">
            {viewingOrder ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Odbiorca</span>
                  <p className="font-bold text-bakery-dark text-sm">{viewingOrder.client_name}</p>
                  <p className="text-xs text-gray-600 font-medium mt-0.5">{viewingOrder.address}</p>
                </div>

                {viewingOrder.day_of_week && (
                  <div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Harmonogram</span>
                    <p className="text-[11px] font-bold text-indigo-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded inline-block uppercase">{viewingOrder.day_of_week}</p>
                  </div>
                )}

                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Zamówiony asortyment</span>
                  <div className="bg-bakery-rowBg rounded border border-bakery-btnBorder divide-y divide-bakery-btnBorder overflow-hidden">
                    {viewingOrder.items && viewingOrder.items.length > 0 ? viewingOrder.items.map((item: OrderItem, idx: number) => (
                      <div key={idx} className="p-2.5 flex justify-between items-center text-xs">
                        <span className="text-bakery-dark font-semibold">{item.product_name}</span>
                        <span className="font-bold text-blue-950 font-mono text-sm">{item.qty} szt.</span>
                      </div>
                    )) : (
                      <p className="p-3 text-xs text-gray-500 font-medium italic text-center">Brak szczegółowych pozycji produktów.</p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-bakery-btnBorder flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-500 uppercase tracking-wide text-xs">Suma końcowa:</span>
                  <span className="text-lg font-black text-blue-950 font-mono">{viewingOrder.total_amount.toFixed(2)} PLN</span>
                </div>
              </div>
            ) : (
              <div className="py-24 text-center text-gray-500 text-xs font-semibold italic">
                Nie wybrano żadnego zamówienia.<br />Kliknij przycisk akcji przy elemencie z listy.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
