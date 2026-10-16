import { useEffect, useState } from 'react';
import { Search, Plus, Edit, Trash2, Calendar, RefreshCw, Clock, Eye, X } from 'lucide-react';

import { type Order, type OrderItem } from '../types';
import { DashboardListScrollbar } from '../components/DashboardListScrollbar';
import { 
  fetchDailyOrders, 
  fetchStandingOrders, 
  fetchOrderHistory, 
  fetchClients, 
  fetchProducts, 
  saveDailyOrder, 
  saveStandingOrder,
  deleteDailyOrder, 
  deleteStandingOrder,
  type AppClient,
  type AppProduct 
} from '../../../services/api';

const STATUS_LABELS: Record<string, string> = {
  planned: 'Zaplanowane',
  in_production: 'W produkcji',
  in_delivery: 'W dostawie',
  delivered: 'Dostarczone',
  failed: 'Nieudana dostawa',
  cancelled: 'Anulowane',
};

const DAYS_OF_WEEK = [
  { id: 0, label: 'Pn' },
  { id: 1, label: 'Wt' },
  { id: 2, label: 'Śr' },
  { id: 3, label: 'Czw' },
  { id: 4, label: 'Pt' },
  { id: 5, label: 'Sb' },
  { id: 6, label: 'Nd' },
];

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
  const [clients, setClients] = useState<AppClient[]>([]);
  const [products, setProducts] = useState<AppProduct[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [formClientId, setFormClientId] = useState<number | ''>('');
  const [formStatus, setFormStatus] = useState<string>('planned');
  const [formItems, setFormItems] = useState<{ product_id: number; product_name: string; qty: number }[]>([]);
  const [selectedProductIdToAdd, setSelectedProductIdToAdd] = useState<number | ''>('');
  const [selectedProductQty, setSelectedProductQty] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formOrderDate, setFormOrderDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formDays, setFormDays] = useState<number[]>([0, 1, 2, 3, 4]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [daily, standing, history, clientList, productList] = await Promise.all([
        fetchDailyOrders(),
        fetchStandingOrders(),
        fetchOrderHistory(),
        fetchClients(),
        fetchProducts(),
      ]);
      setDailyOrders(daily);
      setStandingOrders(standing);
      setHistoryOrders(history);
      setClients(clientList);
      setProducts(productList);
    } catch (error) {
      console.error('Błąd podczas ładowania zamówień:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
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

  const handleOpenAdd = () => {
    setModalMode('add');
    setFormClientId(clients.length > 0 ? clients[0].client_id : '');
    setFormOrderDate(new Date().toISOString().split('T')[0]);
    setFormStatus('planned');
    setFormDays([0, 1, 2, 3, 4]);
    setFormItems([]);
    setSelectedProductIdToAdd(products.length > 0 ? products[0].product_id : '');
    setSelectedProductQty(1);
    setIsModalOpen(true);
  };

  const handleOpenEdit = () => {
    if (activeTab === 'dzisiejsze') {
      const orderToEdit = dailyOrders.find(o => o.id === selectedOrderId);
      if (!orderToEdit) return;

      setModalMode('edit');
      setFormClientId(orderToEdit.client_id || '');
      setFormOrderDate(orderToEdit.date || new Date().toISOString().split('T')[0]);
      setFormStatus(orderToEdit.status || 'planned');
      setFormItems(
        (orderToEdit.items || []).map(i => ({
          product_id: i.product_id,
          product_name: i.product_name,
          qty: i.qty,
        }))
      );
    } else if (activeTab === 'stale') {
      const orderToEdit = standingOrders.find(o => o.id === selectedOrderId);
      if (!orderToEdit) return;

      setModalMode('edit');
      setFormClientId(orderToEdit.client_id || '');
      // Wczytanie dokładnie tych dni, które są zaznaczone w bazie
      setFormDays((orderToEdit as any).days_ids || [0, 1, 2, 3, 4]);
      setFormItems(
        (orderToEdit.items || []).map(i => ({
          product_id: i.product_id,
          product_name: i.product_name,
          qty: i.qty,
        }))
      );
    }

    setSelectedProductIdToAdd(products.length > 0 ? products[0].product_id : '');
    setSelectedProductQty(1);
    setIsModalOpen(true);
  };

  const handleAddItemToForm = () => {
    if (!selectedProductIdToAdd) return;
    const prod = products.find(p => p.product_id === Number(selectedProductIdToAdd));
    if (!prod) return;

    const existingIndex = formItems.findIndex(i => i.product_id === prod.product_id);
    if (existingIndex > -1) {
      const updated = [...formItems];
      updated[existingIndex].qty += selectedProductQty;
      setFormItems(updated);
    } else {
      setFormItems([
        ...formItems,
        {
          product_id: prod.product_id,
          product_name: prod.name,
          qty: selectedProductQty,
        },
      ]);
    }
    setSelectedProductQty(1);
  };

  const handleRemoveItemFromForm = (productId: number) => {
    setFormItems(formItems.filter(i => i.product_id !== productId));
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClientId) {
      alert('Proszę wybrać klienta.');
      return;
    }
    if (formItems.length === 0) {
      alert('Proszę dodać przynajmniej jeden produkt do zamówienia.');
      return;
    }

    try {
      setIsSubmitting(true);

      if (activeTab === 'dzisiejsze') {
        await saveDailyOrder({
          client_id: Number(formClientId),
          order_date: formOrderDate,
          status: formStatus,
          items: formItems.map(i => ({ product_id: i.product_id, qty: i.qty })),
        });
      } else if (activeTab === 'stale') {
        if (formDays.length === 0) {
          alert('Wybierz przynajmniej jeden dzień dostawy.');
          setIsSubmitting(false);
          return;
        }
        await saveStandingOrder({
          client_id: Number(formClientId),
          days: formDays,
          items: formItems.map(i => ({ product_id: i.product_id, qty: i.qty })),
        });
      }

      setIsModalOpen(false);
      setSelectedOrderId(null);
      await loadData();
      alert('Zamówienie zostało zapisane.');
    } catch (err) {
      console.error(err);
      alert('Błąd zapisu zamówienia.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedOrderId) return;
    if (!window.confirm('Czy na pewno chcesz usunąć to zamówienie?')) return;

    try {
      if (activeTab === 'dzisiejsze') {
        await deleteDailyOrder(selectedOrderId);
      } else if (activeTab === 'stale') {
        await deleteStandingOrder(selectedOrderId);
      }
      setSelectedOrderId(null);
      setViewingOrder(null);
      await loadData();
      alert('Zamówienie zostało usunięte.');
    } catch (err) {
      console.error(err);
      alert('Błąd podczas usuwania zamówienia.');
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-8 py-6 flex flex-col gap-5 text-bakery-dark">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="m-0 mb-1 text-2xl font-bold tracking-tight text-bakery-dark">Zarządzanie Zamówieniami</h1>
          <p className="text-xs text-gray-500 font-medium">
            Moduł obsługi zamówień bieżących, harmonogramów stałych i archiwum.
          </p>
        </div>

        <div className="flex bg-bakery-inactive p-1 rounded border border-bakery-btnBorder shadow-sm">
          <button
            onClick={() => {
              setActiveTab('dzisiejsze');
              setSelectedOrderId(null);
              setViewingOrder(null);
            }}
            className={`px-4 py-1.5 text-xs font-semibold rounded transition-all ${activeTab === 'dzisiejsze' ? 'bg-bakery-dark text-white shadow-xs' : 'text-bakery-dark hover:bg-bakery-rowBg'}`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" /> Dzisiejsze
            </div>
          </button>
          <button
            onClick={() => {
              setActiveTab('stale');
              setSelectedOrderId(null);
              setViewingOrder(null);
            }}
            className={`px-4 py-1.5 text-xs font-semibold rounded transition-all ${activeTab === 'stale' ? 'bg-bakery-dark text-white shadow-xs' : 'text-bakery-dark hover:bg-bakery-rowBg'}`}
          >
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Stałe
            </div>
          </button>
          <button
            onClick={() => {
              setActiveTab('historia');
              setSelectedOrderId(null);
              setViewingOrder(null);
            }}
            className={`px-4 py-1.5 text-xs font-semibold rounded transition-all ${activeTab === 'historia' ? 'bg-bakery-dark text-white shadow-xs' : 'text-bakery-dark hover:bg-bakery-rowBg'}`}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> Historia
            </div>
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
                  <div
                    key={productName}
                    className="bg-bakery-rowBg p-2.5 rounded border border-bakery-btnBorder font-semibold"
                  >
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
            <DashboardListScrollbar className="flex-1 min-h-0">
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500 font-semibold">
                  Ładowanie danych z bazy...
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-bakery-inactive z-10">
                    <tr className="border-b border-bakery-btnBorder text-[10px] font-bold text-bakery-dark uppercase tracking-wider">
                      <th className="py-2 px-3 w-12 text-center h-8">Wybór</th>
                      {activeTab === 'historia' && <th className="py-2 px-3 h-8">Data</th>}
                      <th className="py-2 px-3 h-8">Nazwa firmy</th>
                      {activeTab === 'stale' ? (
                        <th className="py-2 px-3 h-8">Dni tygodnia</th>
                      ) : (
                        <th className="py-2 px-3 h-8 text-center">Status</th>
                      )}
                      <th className="py-2 px-3 text-center h-8">Ilość produktów</th>
                      <th className="py-2 px-3 text-right h-8">Wartość</th>
                      <th className="py-2 px-3 text-center h-8">Akcja</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bakery-btnBorder text-sm">
                    {activeTab === 'dzisiejsze' &&
                      dailyOrders.map((order) => (
                        <tr
                          key={order.id}
                          className={`bg-bakery-rowBg hover:bg-bakery-inactive transition border-b border-bakery-btnBorder ${selectedOrderId === order.id ? 'bg-[#c9c3c3]' : ''}`}
                        >
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
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${order.is_standing ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-300 text-gray-700'}`}
                              >
                                {order.is_standing ? 'Stałe' : 'Jednorazowe'}
                              </span>
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-700 border border-amber-200">
                                {STATUS_LABELS[order.status ?? ''] ?? order.status}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center font-semibold text-bakery-dark">
                            {order.total_quantity} szt.
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-bakery-dark">
                            {order.total_amount.toFixed(2)} PLN
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => handleRowClick(order)}
                              className="text-bakery-dark hover:text-white p-1 rounded bg-bakery-inactive hover:bg-bakery-dark border border-bakery-btnBorder inline-flex items-center gap-1 text-[11px] font-bold transition-all shadow-2xs"
                            >
                              <Eye className="w-3.5 h-3.5" /> Szczegóły
                            </button>
                          </td>
                        </tr>
                      ))}

                    {activeTab === 'stale' &&
                      standingOrders.map((order) => (
                        <tr
                          key={order.id}
                          className={`bg-bakery-rowBg hover:bg-bakery-inactive transition border-b border-bakery-btnBorder ${selectedOrderId === order.id ? 'bg-[#c9c3c3]' : ''}`}
                        >
                          <td className="py-2 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedOrderId === order.id}
                              onChange={() => setSelectedOrderId(selectedOrderId === order.id ? null : order.id)}
                              className="rounded border-bakery-border text-bakery-dark focus:ring-bakery-accent w-4 h-4 accent-bakery-dark cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-3 font-semibold text-bakery-dark">{order.client_name}</td>
                          <td className="py-2 px-3 text-bakery-dark text-xs font-semibold italic">
                            {order.day_of_week}
                          </td>
                          <td className="py-2 px-3 text-center font-semibold text-bakery-dark">
                            {order.total_quantity} szt.
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-bakery-dark">
                            {order.total_amount.toFixed(2)} PLN
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => handleRowClick(order)}
                              className="text-bakery-dark hover:text-white p-1 rounded bg-bakery-inactive hover:bg-bakery-dark border border-bakery-btnBorder inline-flex items-center gap-1 text-[11px] font-bold transition-all shadow-2xs"
                            >
                              <Eye className="w-3.5 h-3.5" /> Szczegóły
                            </button>
                          </td>
                        </tr>
                      ))}

                    {activeTab === 'historia' &&
                      filteredHistory.map((order) => (
                        <tr
                          key={order.id}
                          className="bg-bakery-rowBg hover:bg-bakery-inactive transition border-b border-bakery-btnBorder"
                        >
                          <td className="py-2 px-3 text-center text-gray-400 font-bold">-</td>
                          <td className="py-2 px-3 text-bakery-dark font-mono text-xs font-bold">{order.date}</td>
                          <td className="py-2 px-3 font-semibold text-bakery-dark">{order.client_name}</td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${order.status === 'cancelled' ? 'bg-red-100 text-red-700 border border-red-200' : order.status === 'failed' ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}
                            >
                              {STATUS_LABELS[order.status ?? ''] ?? order.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center font-semibold text-bakery-dark">
                            {order.total_quantity} szt.
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-bakery-dark">
                            {order.total_amount.toFixed(2)} PLN
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => handleRowClick(order)}
                              className="text-bakery-dark hover:text-white p-1 rounded bg-bakery-inactive hover:bg-bakery-dark border border-bakery-btnBorder inline-flex items-center gap-1 text-[11px] font-bold transition-all shadow-2xs"
                            >
                              <Eye className="w-3.5 h-3.5" /> Szczegóły
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </DashboardListScrollbar>
          </div>

          {activeTab !== 'historia' && (
            <div className="flex flex-col min-[1016px]:flex-row min-[1016px]:items-center gap-2 bg-bakery-inactive p-3 rounded border border-bakery-btnBorder shadow-sm">
              <div className="flex flex-col items-center min-[1016px]:flex-row gap-2">
                <button
                  onClick={handleOpenAdd}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded transition shadow-xs active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4 text-bakery-accent" /> Dodaj{' '}
                  {activeTab === 'dzisiejsze' ? 'jednorazowe' : 'stałe'}
                </button>

                <button
                  onClick={handleOpenEdit}
                  disabled={!selectedOrderId}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-bakery-rowBg border border-bakery-btnBorder text-bakery-dark rounded shadow-2xs hover:bg-[#dcd8d8] disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.98]"
                >
                  <Edit className="w-4 h-4" /> Edytuj
                </button>

                <button
                  onClick={handleDelete}
                  disabled={!selectedOrderId}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-red-50 border border-red-200 text-red-700 rounded shadow-2xs hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.98]"
                >
                  <Trash2 className="w-4 h-4" /> Usuń
                </button>
              </div>

              {!selectedOrderId && (
                <span className="text-[10px] text-gray-500 font-semibold text-center min-[1016px]:text-left min-[1016px]:ml-2 italic">
                  Zaznacz jedno zamówienie na tabeli, aby je edytować lub usunąć.
                </span>
              )}
            </div>
          )}
        </div>

        <div className="bg-bakery-inactive rounded border border-bakery-btnBorder shadow-sm p-4 flex flex-col h-[460px] overflow-hidden">
          <div className="border-b border-bakery-btnBorder pb-3 shrink-0">
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">Podgląd Szczegółów</h2>
            <p className="text-[11px] text-gray-500 font-medium">
              Kliknij „Szczegóły” w tabeli, by zobaczyć skład pozycji.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto mt-4 pr-1">
            {viewingOrder ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    Odbiorca
                  </span>
                  <p className="font-bold text-bakery-dark text-sm">{viewingOrder.client_name}</p>
                  <p className="text-xs text-gray-600 font-medium mt-0.5">{viewingOrder.address}</p>
                </div>

                {viewingOrder.day_of_week && (
                  <div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                      Harmonogram
                    </span>
                    <p className="text-[11px] font-bold text-indigo-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded inline-block uppercase">
                      {viewingOrder.day_of_week}
                    </p>
                  </div>
                )}

                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-2">
                    Zamówiony asortyment
                  </span>
                  <div className="bg-bakery-rowBg rounded border border-bakery-btnBorder divide-y divide-bakery-btnBorder overflow-hidden">
                    {viewingOrder.items && viewingOrder.items.length > 0 ? (
                      viewingOrder.items.map((item: OrderItem, idx: number) => (
                        <div key={idx} className="p-2.5 flex justify-between items-center text-xs">
                          <span className="text-bakery-dark font-semibold">{item.product_name}</span>
                          <span className="font-bold text-blue-950 font-mono text-sm">{item.qty} szt.</span>
                        </div>
                      ))
                    ) : (
                      <p className="p-3 text-xs text-gray-500 font-medium italic text-center">
                        Brak szczegółowych pozycji produktów.
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-bakery-btnBorder flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-500 uppercase tracking-wide text-xs">Suma końcowa:</span>
                  <span className="text-lg font-black text-blue-950 font-mono">
                    {viewingOrder.total_amount.toFixed(2)} PLN
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-24 text-center text-gray-500 text-xs font-semibold italic">
                Nie wybrano żadnego zamówienia.
                <br />
                Kliknij przycisk akcji przy elemencie z listy.
              </div>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
          <form
            onSubmit={handleSaveOrder}
            className="bg-bakery-inactive border border-bakery-border rounded shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="bg-bakery-dark text-white p-4 flex justify-between items-center shrink-0">
              <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-bakery-accent" />
                {modalMode === 'add'
                  ? activeTab === 'stale'
                    ? 'Nowy Harmonogram Stały'
                    : 'Nowe Zamówienie Jednorazowe'
                  : activeTab === 'stale'
                    ? 'Edycja Harmonogramu Stałego'
                    : 'Edycja Zamówienia'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Klient / Odbiorca *
                </label>
                <select
                  value={formClientId}
                  onChange={(e) => setFormClientId(Number(e.target.value))}
                  disabled={modalMode === 'edit'}
                  className="w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-semibold rounded text-xs p-2 outline-none focus:border-bakery-accent disabled:opacity-60"
                  required
                >
                  <option value="" disabled>
                    Wybierz klienta...
                  </option>
                  {clients.map((c) => (
                    <option key={c.client_id} value={c.client_id}>
                      {c.name} ({c.address})
                    </option>
                  ))}
                </select>
              </div>

              {/* ZAKŁADKA DZISIEJSZE: DATA I STATUS */}
              {activeTab === 'dzisiejsze' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                      Data realizacji zamówienia *
                    </label>
                    <input
                      type="date"
                      value={formOrderDate}
                      onChange={(e) => setFormOrderDate(e.target.value)}
                      disabled={modalMode === 'edit'}
                      className="w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-semibold rounded text-xs p-2 outline-none focus:border-bakery-accent disabled:opacity-60"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                      Status zamówienia
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                      className="w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-semibold rounded text-xs p-2 outline-none focus:border-bakery-accent"
                    >
                      <option value="planned">Zaplanowane</option>
                      <option value="in_production">W produkcji</option>
                      <option value="in_delivery">W dostawie</option>
                      <option value="delivered">Dostarczone</option>
                      <option value="cancelled">Anulowane</option>
                    </select>
                  </div>
                </div>
              )}

              {/* ZAKŁADKA STAŁE: WYBÓR DNI TYGODNIA */}
              {activeTab === 'stale' && (
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Dni realizacji dostaw *
                  </label>
                  <div className="grid grid-cols-7 gap-1">
                    {DAYS_OF_WEEK.map((day) => {
                      const isSelected = formDays.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => {
                            setFormDays(
                              isSelected ? formDays.filter((d) => d !== day.id) : [...formDays, day.id].sort()
                            );
                          }}
                          className={`py-2 text-xs font-bold rounded border transition-all ${
                            isSelected
                              ? 'bg-bakery-dark text-white border-bakery-dark shadow-xs'
                              : 'bg-bakery-rowBg text-gray-600 border-bakery-btnBorder hover:bg-bakery-inactive'
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium block mt-1">
                    Kliknij dni, w które zamówienie ma być cyklicznie przygotowywane.
                  </span>
                </div>
              )}

              <div className="border-t border-bakery-btnBorder pt-3">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-2">
                  Dodaj wypiek / produkt
                </label>
                <div className="flex gap-2 items-center">
                  <select
                    value={selectedProductIdToAdd}
                    onChange={(e) => setSelectedProductIdToAdd(Number(e.target.value))}
                    className="flex-1 border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-semibold rounded text-xs p-2 outline-none focus:border-bakery-accent"
                  >
                    {products.map((p) => (
                      <option key={p.product_id} value={p.product_id}>
                        {p.name} ({p.base_price} PLN)
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={selectedProductQty}
                    onChange={(e) => setSelectedProductQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-semibold rounded text-xs p-2 outline-none text-center"
                  />
                  <button
                    type="button"
                    onClick={handleAddItemToForm}
                    className="px-3 py-2 text-xs font-bold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded transition shadow-xs flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5 text-bakery-accent" /> Dodaj
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Wybrane pozycje:
                </label>
                <div className="bg-bakery-rowBg rounded border border-bakery-btnBorder divide-y divide-bakery-btnBorder max-h-48 overflow-y-auto">
                  {formItems.length > 0 ? (
                    formItems.map((item) => (
                      <div key={item.product_id} className="p-2 flex justify-between items-center text-xs">
                        <span className="font-semibold text-bakery-dark">{item.product_name}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold">{item.qty} szt.</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItemFromForm(item.product_id)}
                            className="text-red-700 hover:text-red-900"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-xs text-center text-gray-400 italic">Brak dodanych produktów.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-bakery-rowBg p-3 border-t border-bakery-btnBorder flex justify-end gap-2 shrink-0">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded shadow-xs transition disabled:opacity-50"
              >
                {isSubmitting ? 'Zapisywanie...' : 'Zapisz Zamówienie'}
              </button>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-bold bg-bakery-inactive border border-bakery-btnBorder text-bakery-dark rounded transition"
              >
                Anuluj
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}