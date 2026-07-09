import { useEffect, useState } from 'react';
import { Truck, MapPin, User, AlertTriangle, Package } from 'lucide-react';
import {
  fetchLogistics,
  updateOrderStatus,
  type LogisticsData,
  type LogisticsOrder,
  type LogisticsStop,
} from '../../../services/api';
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS, getNextStep } from '../lib/logisticsStatus';

function StatusBadge({ status }: { status: LogisticsOrder['status'] }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap"
      style={{
        color: ORDER_STATUS_COLORS[status],
        backgroundColor: `${ORDER_STATUS_COLORS[status]}1a`,
        border: `1px solid ${ORDER_STATUS_COLORS[status]}40`,
      }}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

function StopCard({
  stop,
  onAdvance,
  updatingId,
}: {
  stop: LogisticsStop;
  onAdvance: (orderId: number, nextStatus: LogisticsOrder['status']) => void;
  updatingId: number | null;
}) {
  const hasDeliveryToday = stop.orders.length > 0;

  return (
    <div
      className={`border rounded p-3 flex flex-col gap-2 ${
        hasDeliveryToday
          ? 'bg-bakery-rowBg border-bakery-btnBorder'
          : 'bg-bakery-rowBg/40 border-bakery-btnBorder border-dashed opacity-60'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-sm text-bakery-dark m-0">{stop.name}</p>
          <p className="text-xs text-gray-500 font-semibold flex items-center gap-1 mt-0.5">
            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {stop.address}
          </p>
        </div>
        {!hasDeliveryToday && (
          <span className="text-[10px] font-bold uppercase text-gray-400 italic whitespace-nowrap">
            Brak dostawy dzisiaj
          </span>
        )}
      </div>

      {hasDeliveryToday && (
      <div className="flex flex-col gap-1.5 mt-1">
        {stop.orders.map((order) => {
          const next = getNextStep(order.status);
          return (
            <div
              key={order.do_id}
              className="flex items-center justify-between gap-2 bg-bakery-inactive border border-bakery-btnBorder rounded px-2 py-1.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Package className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-xs font-semibold text-bakery-dark truncate">
                  {order.product_name} <span className="text-gray-500 font-mono">x{order.quantity}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={order.status} />
                {next && (
                  <button
                    onClick={() => onAdvance(order.do_id, next.status)}
                    disabled={updatingId === order.do_id}
                    className="px-2 py-1 text-[10px] font-bold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded shadow-xs transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {updatingId === order.do_id ? '...' : next.label}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

export default function Logistics() {
  const [data, setData] = useState<LogisticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchLogistics()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAdvance = async (orderId: number, nextStatus: LogisticsOrder['status']) => {
    setUpdatingId(orderId);
    try {
      await updateOrderStatus(orderId, nextStatus);
      setData((prev) => {
        if (!prev) return prev;
        const patchStop = (stop: LogisticsStop): LogisticsStop => ({
          ...stop,
          orders: stop.orders.map((o) => (o.do_id === orderId ? { ...o, status: nextStatus } : o)),
        });
        return {
          ...prev,
          routes: prev.routes.map((route) => ({ ...route, stops: route.stops.map(patchStop) })),
          unassigned: prev.unassigned.map(patchStop),
        };
      });
    } catch (err) {
      console.error('Błąd podczas aktualizacji statusu zamówienia:', err);
      alert('Nie udało się zaktualizować statusu zamówienia.');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-8 py-6 text-bakery-dark">
        <h1 className="text-2xl font-bold mb-2">Logistyka i Trasy</h1>
        <p>Ładowanie danych...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-7xl mx-auto px-8 py-6 text-bakery-dark">
        <h1 className="text-2xl font-bold mb-2">Logistyka i Trasy</h1>
        <p className="text-red-600">Błąd połączenia z serwerem: {error}</p>
      </div>
    );
  }

  const routes = data?.routes ?? [];
  const unassigned = data?.unassigned ?? [];
  const deliveriesToday =
    routes.reduce((sum, r) => sum + r.stops.filter((s) => s.orders.length > 0).length, 0) + unassigned.length;

  return (
    <div className="w-full max-w-7xl mx-auto px-8 py-6 flex flex-col gap-5 text-bakery-dark">
      <div>
        <h1 className="m-0 mb-1 text-2xl font-bold tracking-tight text-bakery-dark">Logistyka i Trasy</h1>
        <p className="text-xs text-gray-500 font-medium">
          Plan dostaw na dziś ({data?.date}) — {deliveriesToday}{' '}
          {deliveriesToday === 1 ? 'dostawa' : 'dostaw(y)'} w {routes.length}{' '}
          {routes.length === 1 ? 'trasie' : 'trasach'}.
        </p>
      </div>

      <hr className="border-0 border-t border-bakery-border my-1" />

      {routes.length === 0 && unassigned.length === 0 ? (
        <div className="bg-bakery-inactive rounded border border-bakery-btnBorder shadow-sm p-8 text-center text-gray-500 text-sm font-semibold italic">
          Brak skonfigurowanych aktywnych tras.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {routes.map((route) => (
            <div
              key={route.route_id}
              className="bg-bakery-inactive rounded border border-bakery-btnBorder shadow-sm flex flex-col overflow-hidden"
            >
              <div className="bg-bakery-dark text-white p-3 flex items-center justify-between gap-2 shrink-0">
                <span className="text-sm font-bold flex items-center gap-2">
                  <Truck className="w-4 h-4 text-bakery-accent" /> {route.route_name}
                </span>
                <span className="text-xs font-semibold flex items-center gap-1.5 text-gray-300">
                  <User className="w-3.5 h-3.5" />
                  {route.driver ? route.driver.full_name : 'Brak kierowcy'}
                </span>
              </div>

              <div className="p-3 flex flex-col gap-2">
                {route.stops.length === 0 ? (
                  <p className="text-xs text-gray-500 italic font-semibold text-center py-4">
                    Brak dostaw na tej trasie dzisiaj.
                  </p>
                ) : (
                  route.stops.map((stop) => (
                    <StopCard key={stop.client_id} stop={stop} onAdvance={handleAdvance} updatingId={updatingId} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {unassigned.length > 0 && (
        <div className="bg-bakery-inactive rounded border border-amber-400 shadow-sm overflow-hidden">
          <div className="bg-amber-50 border-b border-amber-300 p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-bold text-amber-800">
              Klienci bez przypisanej trasy ({unassigned.length})
            </span>
          </div>
          <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {unassigned.map((stop) => (
              <StopCard key={stop.client_id} stop={stop} onAdvance={handleAdvance} updatingId={updatingId} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
