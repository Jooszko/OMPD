import { AlertTriangle, MapPin, Package } from 'lucide-react';
import { type LogisticsOrder, type LogisticsStop } from '../../../services/api';
import { FAILURE_REASON_LABELS, ORDER_STATUS_COLORS, ORDER_STATUS_LABELS, getNextStep } from '../lib/logisticsStatus';
import { formatTime } from '../lib/dateFormat';

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

export function StopCard({
  stop,
  onAdvance,
  updatingId,
}: {
  stop: LogisticsStop;
  onAdvance: (orderId: number, nextStatus: LogisticsOrder['status']) => void;
  updatingId: number | null;
}) {
  const hasDeliveryToday = stop.orders.length > 0;
  const hasProblem = stop.orders.some((o) => o.status === 'failed');

  const handleCancel = (order: LogisticsOrder) => {
    const confirmed = window.confirm(
      `Anulować zamówienie „${order.product_name} x${order.quantity}” dla ${stop.name}?\nAnulowane zamówienie zniknie z logistyki.`
    );
    if (confirmed) onAdvance(order.do_id, 'cancelled');
  };

  return (
    <div
      className={`border rounded-lg p-3 flex flex-col gap-2 transition ${
        !hasDeliveryToday
          ? 'bg-bakery-rowBg/40 border-bakery-btnBorder border-dashed opacity-60'
          : hasProblem
            ? 'bg-bakery-rowBg border-rose-300 ring-1 ring-rose-200 shadow-xs'
            : 'bg-bakery-rowBg border-bakery-btnBorder shadow-xs hover:shadow-sm'
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
        {hasProblem && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold uppercase whitespace-nowrap">
            <AlertTriangle className="w-3 h-3" /> Problem z dostawą
          </span>
        )}
      </div>

      {hasDeliveryToday && (
        <div className="flex flex-col gap-1.5 mt-1">
          {stop.orders.map((order) => {
            const next = getNextStep(order.status);
            const busy = updatingId === order.do_id;
            return (
              <div
                key={order.do_id}
                className="flex flex-col gap-1 bg-bakery-inactive border border-bakery-btnBorder rounded px-2 py-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="text-xs font-semibold text-bakery-dark truncate">
                      {order.product_name} <span className="text-gray-500 font-mono">x{order.quantity}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={order.status} />
                    {order.status === 'failed' && (
                      <button
                        onClick={() => handleCancel(order)}
                        disabled={busy}
                        className="px-2 py-1 text-[10px] font-bold bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded shadow-xs transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        Anuluj
                      </button>
                    )}
                    {next && (
                      <button
                        onClick={() => onAdvance(order.do_id, next.status)}
                        disabled={busy}
                        className="px-2 py-1 text-[10px] font-bold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded shadow-xs transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {busy ? '...' : next.label}
                      </button>
                    )}
                  </div>
                </div>
                {order.status === 'failed' && (
                  <p className="m-0 pl-5.5 text-[11px] text-rose-700 font-semibold">
                    {order.failure_reason && FAILURE_REASON_LABELS[order.failure_reason]}
                    {order.failed_at && ` · ${formatTime(order.failed_at)}`}
                    {order.failure_note && (
                      <span className="text-gray-600 font-normal italic"> — „{order.failure_note}”</span>
                    )}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
