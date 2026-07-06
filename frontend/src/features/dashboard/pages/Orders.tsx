import React, { useState } from 'react';
import { Search, Plus, Edit, Trash2, Calendar, RefreshCw, Clock, Eye } from 'lucide-react';

import { type Order, type OrderItem } from '../types';

const MOCK_PRODUCTS = {
  1: { name: 'Chleb Wiejski 500g', category: 'Chleb' },
  2: { name: 'Bułka Kajzerka', category: 'Bułki' },
  3: { name: 'Rogal Maślany', category: 'Cukiernictwo' },
};

const MOCK_CLIENTS = {
  101: { name: 'Sklep Spożywczy "U Gosi"', address: 'Górki Wielkie, Główna 12', route: 'Trasa Skoczów' },
  102: { name: 'Restauracja Pod Jelenie', address: 'Bielsko-Biała, Rynek 4', route: 'Trasa Bielsko' },
  103: { name: 'Prywatne - Jan Kowalski', address: 'Bielsko-Biała, Szeroka 5', route: 'Odbiór Osobisty' },
};

const MOCK_DAILY_ORDERS = [
  { id: 1, client_id: 101, total_quantity: 60, total_amount: 240.00, is_standing: true, status: 'Spakowane', items: [{ product_id: 1, qty: 50 }, { product_id: 2, qty: 10 }] },
  { id: 2, client_id: 102, total_quantity: 110, total_amount: 385.00, is_standing: false, status: 'W produkcji', items: [{ product_id: 2, qty: 100 }, { product_id: 3, qty: 10 }] },
  { id: 3, client_id: 103, total_quantity: 5, total_amount: 25.00, is_standing: false, status: 'Oczekuje', items: [{ product_id: 1, qty: 5 }] },
];

const MOCK_STANDING_ORDERS = [
  { id: 10, client_id: 101, day_of_week: 'Poniedziałek, Środa, Piątek', total_quantity: 60, total_amount: 240.00, items: [{ product_id: 1, qty: 50 }, { product_id: 2, qty: 10 }] },
  { id: 20, client_id: 102, day_of_week: 'Codziennie', total_quantity: 150, total_amount: 500.00, items: [{ product_id: 2, qty: 150 }] },
];

const MOCK_HISTORY_ORDERS = [
  { id: 501, date: '2026-07-04', client_id: 101, total_quantity: 45, total_amount: 180.00, status: 'Zrealizowane' },
  { id: 502, date: '2026-07-03', client_id: 102, total_quantity: 110, total_amount: 385.00, status: 'Zrealizowane' },
  { id: 503, date: '2026-07-02', client_id: 103, total_quantity: 8, total_amount: 34.50, status: 'Anulowane' },
];

export default function ZamowieniaPanel() {
  const [activeTab, setActiveTab] = useState<'dzisiejsze' | 'stale' | 'historia'>('dzisiejsze');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');

  const handleRowClick = (order: Order) => {
    setViewingOrder(order);
  };

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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-sm text-bakery-dark font-medium">
              <div className="bg-bakery-rowBg p-2.5 rounded border border-bakery-btnBorder font-semibold">Chleb Wiejski: <span className="font-bold text-base text-blue-950">55 szt.</span></div>
              <div className="bg-bakery-rowBg p-2.5 rounded border border-bakery-btnBorder font-semibold">Bułka Kajzerka: <span className="font-bold text-base text-blue-950">110 szt.</span></div>
              <div className="bg-bakery-rowBg p-2.5 rounded border border-bakery-btnBorder font-semibold">Rogal Maślany: <span className="font-bold text-base text-blue-950">10 szt.</span></div>
            </div>
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
            <div className="flex-1 overflow-y-auto p-2">
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
                  
                  {activeTab === 'dzisiejsze' && MOCK_DAILY_ORDERS.map((order) => (
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
                        {MOCK_CLIENTS[order.client_id as keyof typeof MOCK_CLIENTS]?.name}
                        <span className="block text-[11px] text-gray-500 font-medium">{MOCK_CLIENTS[order.client_id as keyof typeof MOCK_CLIENTS]?.route}</span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex gap-1.5 items-center justify-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${order.is_standing ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-300 text-gray-700'}`}>
                            {order.is_standing ? 'Stałe' : 'Jednorazowe'}
                          </span>
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-700 border border-amber-200">{order.status}</span>
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

                  {activeTab === 'stale' && MOCK_STANDING_ORDERS.map((order) => (
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
                        {MOCK_CLIENTS[order.client_id as keyof typeof MOCK_CLIENTS]?.name}
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

                  {activeTab === 'historia' && MOCK_HISTORY_ORDERS.map((order) => (
                    <tr key={order.id} className="bg-bakery-rowBg hover:bg-bakery-inactive transition border-b border-bakery-btnBorder">
                      <td className="py-2 px-3 text-center text-gray-400 font-bold">-</td>
                      <td className="py-2 px-3 text-bakery-dark font-mono text-xs font-bold">{order.date}</td>
                      <td className="py-2 px-3 font-semibold text-bakery-dark">
                        {MOCK_CLIENTS[order.client_id as keyof typeof MOCK_CLIENTS]?.name}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${order.status === 'Anulowane' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>{order.status}</span>
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
                  <p className="font-bold text-bakery-dark text-sm">{MOCK_CLIENTS[viewingOrder.client_id as keyof typeof MOCK_CLIENTS]?.name}</p>
                  <p className="text-xs text-gray-600 font-medium mt-0.5">{MOCK_CLIENTS[viewingOrder.client_id as keyof typeof MOCK_CLIENTS]?.address}</p>
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
                    {viewingOrder.items ? viewingOrder.items.map((item: OrderItem, idx: number) => (
                      <div key={idx} className="p-2.5 flex justify-between items-center text-xs">
                        <span className="text-bakery-dark font-semibold">{MOCK_PRODUCTS[item.product_id as keyof typeof MOCK_PRODUCTS]?.name}</span>
                        <span className="font-bold text-blue-950 font-mono text-sm">{item.qty} szt.</span>
                      </div>
                    )) : (
                      <p className="p-3 text-xs text-gray-500 font-medium italic text-center">Brak szczegółowych pozycji produktów w mocku historycznym.</p>
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