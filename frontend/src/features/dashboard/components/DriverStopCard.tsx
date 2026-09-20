import { MapPin, Package } from 'lucide-react';
import { type LogisticsOrder, type LogisticsStop } from '../../../services/api';
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS, getDriverNextStep } from '../lib/logisticsStatus';

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

export function DriverStopCard({
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
      className={`border rounded-lg p-3 flex flex-col gap-2 transition ${
        hasDeliveryToday
          ? 'bg-bakery-rowBg border-bakery-btnBorder shadow-xs hover:shadow-sm'
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
            const next = getDriverNextStep(order.status);
            return (
              <div
                key={order.do_id}
                className="flex flex-col gap-2 bg-bakery-inactive border border-bakery-btnBorder rounded-lg px-3 py-2.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-sm font-semibold text-bakery-dark truncate">
                    {order.product_name} <span className="text-gray-500 font-mono">x{order.quantity}</span>
                  </span>
                </div>
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <StatusBadge status={order.status} />
                  {next && (
                    <button
                      onClick={() => onAdvance(order.do_id, next.status)}
                      disabled={updatingId === order.do_id}
                      className="w-full sm:w-auto inline-flex items-center justify-center min-h-[44px] sm:min-h-0 px-4 sm:px-3.5 sm:py-1.5 text-xs font-bold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded-lg shadow-xs transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
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
