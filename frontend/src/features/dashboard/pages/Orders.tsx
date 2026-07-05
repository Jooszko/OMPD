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
    <div className="p-6 max-w-7xl mx-auto bg-slate-50 min-h-screen text-slate-800 font-sans">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Zarządzanie Zamówieniami</h1>
          <p className="text-sm text-slate-500">Moduł obsługi zamówień bieżących, harmonogramów stałych i archiwum.</p>
        </div>
        

        <div className="flex bg-slate-200/80 p-1 rounded-lg border border-slate-300/50">
          <button
            onClick={() => { setActiveTab('dzisiejsze'); setSelectedOrderId(null); setViewingOrder(null); }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'dzisiejsze' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Dzisiejsze</div>
          </button>
          <button
            onClick={() => { setActiveTab('stale'); setSelectedOrderId(null); setViewingOrder(null); }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'stale' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <div className="flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Stałe</div>
          </button>
          <button
            onClick={() => { setActiveTab('historia'); setSelectedOrderId(null); setViewingOrder(null); }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'historia' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <div className="flex items-center gap-2"><Clock className="w-4 h-4" /> Historia</div>
          </button>
        </div>
      </div>


      {activeTab === 'dzisiejsze' && (
        <div className="mb-6 bg-amber-50 border border-amber-200 p-4 rounded-xl shadow-xs">
          <h3 className="text-sm font-semibold text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-2">
            🥖 Sumaryczna produkcja na dziś (Zbiorówka wypieku):
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-sm text-amber-950 font-medium">
            <div className="bg-white p-2 rounded-lg border border-amber-200/60 shadow-2xs">Chleb Wiejski: <span className="font-bold text-base text-amber-700">55 szt.</span></div>
            <div className="bg-white p-2 rounded-lg border border-amber-200/60 shadow-2xs">Bułka Kajzerka: <span className="font-bold text-base text-amber-700">110 szt.</span></div>
            <div className="bg-white p-2 rounded-lg border border-amber-200/60 shadow-2xs">Rogal Maślany: <span className="font-bold text-base text-amber-700">10 szt.</span></div>
          </div>
        </div>
      )}


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        

        <div className="lg:col-span-2 space-y-4">
          

          {activeTab === 'historia' && (
            <div className="flex gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Szukaj po nazwie klienta..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-slate-200 bg-slate-50 rounded-lg text-sm px-3 focus:outline-none"
              >
                <option value="date">Sortuj: Data najnowsza</option>
                <option value="amount">Sortuj: Kwota rosnąco</option>
              </select>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="p-4 w-12 text-center">Wybór</th>
                  {activeTab === 'historia' && <th className="p-4">Data</th>}
                  <th className="p-4">Dla kogo</th>
                  {activeTab === 'stale' ? <th className="p-4">Dni tygodnia</th> : <th className="p-4">Typ / Status</th>}
                  <th className="p-4 text-right">Ilość (szt)</th>
                  <th className="p-4 text-right">Kwota</th>
                  <th className="p-4 text-center">Akcja</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                

                {activeTab === 'dzisiejsze' && MOCK_DAILY_ORDERS.map((order) => (
                  <tr key={order.id} className={`hover:bg-slate-50/80 transition ${selectedOrderId === order.id ? 'bg-blue-50/40' : ''}`}>
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedOrderId === order.id}
                        onChange={() => setSelectedOrderId(selectedOrderId === order.id ? null : order.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                    </td>
                    <td className="p-4 font-medium text-slate-900">
                      {MOCK_CLIENTS[order.client_id as keyof typeof MOCK_CLIENTS]?.name}
                      <span className="block text-xs text-slate-400 font-normal">{MOCK_CLIENTS[order.client_id as keyof typeof MOCK_CLIENTS]?.route}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2 items-center">
                        <span className={`px-2 py-0.5 text-2xs font-semibold rounded-full ${order.is_standing ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                          {order.is_standing ? 'Stałe' : 'Jednorazowe'}
                        </span>
                        <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">{order.status}</span>
                      </div>
                    </td>
                    <td className="p-4 text-right font-semibold">{order.total_quantity}</td>
                    <td className="p-4 text-right font-medium text-slate-900">{order.total_amount.toFixed(2)} zł</td>
                    <td className="p-4 text-center">
                      <button onClick={() => handleRowClick(order)} className="text-slate-400 hover:text-blue-600 p-1 rounded-md hover:bg-slate-100 inline-flex items-center gap-1 text-xs">
                        <Eye className="w-4 h-4" /> Szczegóły
                      </button>
                    </td>
                  </tr>
                ))}


                {activeTab === 'stale' && MOCK_STANDING_ORDERS.map((order) => (
                  <tr key={order.id} className={`hover:bg-slate-50/80 transition ${selectedOrderId === order.id ? 'bg-blue-50/40' : ''}`}>
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedOrderId === order.id}
                        onChange={() => setSelectedOrderId(selectedOrderId === order.id ? null : order.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                    </td>
                    <td className="p-4 font-medium text-slate-900">
                      {MOCK_CLIENTS[order.client_id as keyof typeof MOCK_CLIENTS]?.name}
                    </td>
                    <td className="p-4 text-slate-600 text-xs font-medium italic">{order.day_of_week}</td>
                    <td className="p-4 text-right font-semibold">{order.total_quantity}</td>
                    <td className="p-4 text-right font-medium text-slate-900">{order.total_amount.toFixed(2)} zł</td>
                    <td className="p-4 text-center">
                      <button onClick={() => handleRowClick(order)} className="text-slate-400 hover:text-blue-600 p-1 rounded-md hover:bg-slate-100 inline-flex items-center gap-1 text-xs">
                        <Eye className="w-4 h-4" /> Szczegóły
                      </button>
                    </td>
                  </tr>
                ))}


                {activeTab === 'historia' && MOCK_HISTORY_ORDERS.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4 text-center">-</td>
                    <td className="p-4 text-slate-600 font-mono text-xs">{order.date}</td>
                    <td className="p-4 font-medium text-slate-900">
                      {MOCK_CLIENTS[order.client_id as keyof typeof MOCK_CLIENTS]?.name}
                    </td>
                    <td className="p-4">
                      <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">{order.status}</span>
                    </td>
                    <td className="p-4 text-right font-semibold">{order.total_quantity}</td>
                    <td className="p-4 text-right font-medium text-slate-900">{order.total_amount.toFixed(2)} zł</td>
                    <td className="p-4 text-center">
                      <button onClick={() => handleRowClick(order)} className="text-slate-400 hover:text-blue-600 p-1 rounded-md hover:bg-slate-100 inline-flex items-center gap-1 text-xs">
                        <Eye className="w-4 h-4" /> Szczegóły
                      </button>
                    </td>
                  </tr>
                ))}

              </tbody>
            </table>
          </div>


          {activeTab !== 'historia' && (
            <div className="flex gap-2 items-center bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <button className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition">
                <Plus className="w-4 h-4" /> Dodaj {activeTab === 'dzisiejsze' ? 'jednorazowe' : 'stałe'}
              </button>
              
              <button 
                disabled={!selectedOrderId}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg shadow-2xs hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Edit className="w-4 h-4" /> Edytuj
              </button>
              
              <button 
                disabled={!selectedOrderId}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-white border border-red-200 text-red-600 rounded-lg shadow-2xs hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Trash2 className="w-4 h-4" /> Usuń
              </button>

              {!selectedOrderId && (
                <span className="text-2xs text-slate-400 ml-2 italic">Zaznacz jedno zamówienie na tabeli, aby je edytować lub usunąć.</span>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-950">Podgląd Szczegółów</h2>
            <p className="text-xs text-slate-400">Kliknij „Szczegóły” w tabeli, by zobaczyć skład popozycji.</p>
          </div>

          {viewingOrder ? (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider block">Odbiorca</span>
                <p className="font-semibold text-slate-900 text-sm">{MOCK_CLIENTS[viewingOrder.client_id as keyof typeof MOCK_CLIENTS]?.name}</p>
                <p className="text-xs text-slate-500">{MOCK_CLIENTS[viewingOrder.client_id as keyof typeof MOCK_CLIENTS]?.address}</p>
              </div>

              {viewingOrder.day_of_week && (
                <div>
                  <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider block">Harmonogram</span>
                  <p className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-1 rounded inline-block mt-1">{viewingOrder.day_of_week}</p>
                </div>
              )}

              <div>
                <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Zamówiony asortyment (`items`)</span>
                <div className="bg-slate-50 rounded-lg border border-slate-100 divide-y divide-slate-200/60 overflow-hidden">
                  {viewingOrder.items ? viewingOrder.items.map((item: OrderItem, idx: number) => (
                    <div key={idx} className="p-2.5 flex justify-between text-xs">
                      <span className="text-slate-700 font-medium">{MOCK_PRODUCTS[item.product_id as keyof typeof MOCK_PRODUCTS]?.name}</span>
                      <span className="font-bold text-slate-900">{item.qty} szt.</span>
                    </div>
                  )) : (
                    <p className="p-3 text-xs text-slate-400 italic">Brak szczegółowych pozycji produktów w mocku historycznym.</p>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-sm">
                <span className="font-medium text-slate-500">Suma końcowa:</span>
                <span className="text-base font-bold text-blue-600">{viewingOrder.total_amount.toFixed(2)} zł</span>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs italic">
              Nie wybrano żadnego zamówienia. Kliknij przycisk akcji przy elemencie z listy.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}