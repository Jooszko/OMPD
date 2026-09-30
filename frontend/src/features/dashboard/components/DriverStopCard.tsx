import { useState } from 'react';
import { ChevronDown, ChevronUp, CircleCheck, MapPin, Navigation, Package } from 'lucide-react';
import { type LogisticsOrder, type LogisticsStop } from '../../../services/api';
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS, getDriverNextStep } from '../lib/logisticsStatus';
import { isStopDelivered } from '../lib/routeProgress';
import { buildGoogleMapsStopUrl } from '../lib/navigationLinks';

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

function SequenceBadge({ sequence, delivered }: { sequence: number; delivered: boolean }) {
  return (
    <span
      className={`shrink-0 w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center ${
        delivered ? 'bg-emerald-600 text-white' : 'bg-bakery-accent text-black'
      }`}
    >
      {sequence}
    </span>
  );
}

export function DriverStopCard({
  stop,
  sequence,
  isNext = false,
  onAdvance,
  updatingId,
}: {
  stop: LogisticsStop;
  sequence?: number | null;
  isNext?: boolean;
  onAdvance: (orderId: number, nextStatus: LogisticsOrder['status']) => void;
  updatingId: number | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDeliveryToday = stop.orders.length > 0;
  const delivered = isStopDelivered(stop);

  if (delivered && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-expanded={false}
        className="w-full text-left border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50 rounded-lg px-3 py-2 flex items-center gap-2.5 transition"
      >
        {sequence != null ? (
          <SequenceBadge sequence={sequence} delivered />
        ) : (
          <CircleCheck className="w-5 h-5 text-emerald-600 shrink-0" />
        )}
        <span className="flex-1 min-w-0 text-sm font-semibold text-gray-500 truncate">{stop.name}</span>
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700 whitespace-nowrap">
          <CircleCheck className="w-3.5 h-3.5" /> Dostarczone
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </button>
    );
  }

  return (
    <div
      className={`border rounded-lg p-3 flex flex-col gap-2 transition ${
        !hasDeliveryToday
          ? 'bg-bakery-rowBg/40 border-bakery-btnBorder border-dashed opacity-60'
          : isNext
            ? 'bg-bakery-rowBg border-bakery-accent ring-1 ring-bakery-accent shadow-sm'
            : 'bg-bakery-rowBg border-bakery-btnBorder shadow-xs hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          {sequence != null && <SequenceBadge sequence={sequence} delivered={delivered} />}
          <div className="min-w-0">
            <p className="font-bold text-sm text-bakery-dark m-0">{stop.name}</p>
            <p className="text-xs text-gray-500 font-semibold flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {stop.address}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {!hasDeliveryToday && (
            <span className="text-[10px] font-bold uppercase text-gray-400 italic whitespace-nowrap">
              Brak dostawy dzisiaj
            </span>
          )}
          {isNext && (
            <span className="px-2 py-0.5 rounded bg-bakery-accent text-black text-[10px] font-bold uppercase whitespace-nowrap">
              Następny
            </span>
          )}
          {delivered && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-expanded
              className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-500 hover:text-bakery-dark whitespace-nowrap"
            >
              Zwiń <ChevronUp className="w-3.5 h-3.5" />
            </button>
          )}
          {hasDeliveryToday && !delivered && (
            <a
              href={buildGoogleMapsStopUrl(stop)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Nawiguj do: ${stop.name}`}
              title="Nawiguj do klienta"
              className="inline-flex items-center justify-center gap-1.5 w-11 h-11 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 text-xs font-bold bg-white border border-bakery-btnBorder text-bakery-dark rounded-lg shadow-xs transition hover:bg-bakery-inactive active:scale-[0.98]"
            >
              <Navigation className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-bakery-dark sm:text-bakery-accent" />
              <span className="hidden sm:inline">Nawiguj</span>
            </a>
          )}
        </div>
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
