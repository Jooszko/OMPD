import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Lock, MapPin, Pencil, Printer, Trash2, Truck } from 'lucide-react';
import type { OrderDayRoute, OrderDayStop } from '../../../services/api';
import { STATUS_META, formatMoney, formatPieces, plural } from '../lib/orders';
import { printRouteParam } from '../lib/print';

const COLUMNS = '@3xl:grid @3xl:grid-cols-[minmax(240px,1fr)_150px_110px_120px_24px] @3xl:gap-3';

export function StatusBadge({ status }: { status: OrderDayStop['status'] }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold ${STATUS_META[status].badge}`}>
      {STATUS_META[status].label}
    </span>
  );
}

function StopRow({
  stop,
  onEdit,
  onDelete,
}: {
  stop: OrderDayStop;
  onEdit: (stop: OrderDayStop) => void;
  onDelete: (stop: OrderDayStop) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="border-t border-[#e6e1df]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`w-full text-left flex ${COLUMNS} items-center gap-3 px-4 md:px-5 py-3 transition ${
          open ? 'bg-[#f3efed]' : 'hover:bg-[#f3efed]'
        }`}
      >
        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-extrabold">{stop.client_name}</span>
            {stop.is_standing && (
              <span className="px-2 py-0.5 rounded-full bg-[#dfe8f6] text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#1d4f91]">
                Stałe
              </span>
            )}
          </span>
          <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#5f5a58]">
            <MapPin aria-hidden className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{stop.address}</span>
          </span>
          <span className="@3xl:hidden mt-1 flex flex-wrap items-center gap-2 text-[13px] font-bold">
            <StatusBadge status={stop.status} />
            {formatPieces(stop.total_quantity)} · {formatMoney(stop.total_amount)}
          </span>
        </span>
        <span className="hidden @3xl:block">
          <StatusBadge status={stop.status} />
        </span>
        <span className="hidden @3xl:block text-right text-sm font-bold tabular-nums">
          {formatPieces(stop.total_quantity)}
        </span>
        <span className="hidden @3xl:block text-right text-sm font-extrabold tabular-nums">
          {formatMoney(stop.total_amount)}
        </span>
        <ChevronDown
          aria-hidden
          className={`w-5 h-5 shrink-0 text-[#8a8482] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-4 md:px-5 pb-4 pt-1 bg-[#f3efed] flex flex-col gap-3">
          <ul className="m-0 p-0 list-none rounded-xl border border-[#e2dcda] bg-white divide-y divide-[#eee9e7]">
            {stop.items.map((item) => (
              <li
                key={item.product_id}
                className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px] font-bold ${
                  item.status === 'cancelled' ? 'text-[#8a8482] line-through' : ''
                }`}
              >
                <span className="truncate">{item.product_name}</span>
                <span className="flex items-baseline gap-3 whitespace-nowrap tabular-nums">
                  <span className="font-semibold text-[#5f5a58]">
                    {formatPieces(item.qty)} × {formatMoney(item.price)}
                  </span>
                  <span className="min-w-[80px] text-right">{formatMoney(item.qty * item.price)}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {stop.locked ? (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#5f5a58]">
                <Lock aria-hidden className="w-4 h-4" />
                Zamówienie jest już w dostawie, dostarczone albo minione – nie można go zmienić.
              </span>
            ) : (
              <span />
            )}
            {!stop.locked && (
              <span className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onDelete(stop)}
                  className="inline-flex items-center gap-1.5 min-h-10 px-3.5 rounded-[10px] border border-[#e9b4b4] bg-white text-[13px] font-extrabold text-[#b91c1c]"
                >
                  <Trash2 aria-hidden className="w-4 h-4" />
                  Usuń
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(stop)}
                  className="inline-flex items-center gap-1.5 min-h-10 px-3.5 rounded-[10px] bg-bakery-dark text-[13px] font-extrabold text-white"
                >
                  <Pencil aria-hidden className="w-4 h-4 text-bakery-accent" />
                  Edytuj
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export function DayRoutes({
  date,
  routes,
  onEdit,
  onDelete,
}: {
  date: string;
  routes: OrderDayRoute[];
  onEdit: (stop: OrderDayStop) => void;
  onDelete: (stop: OrderDayStop) => void;
}) {
  return (
    <section className="@container bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm overflow-hidden">
      <div
        aria-hidden
        className={`hidden ${COLUMNS} items-center px-5 py-3 whitespace-nowrap text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#5f5a58]`}
      >
        <span>Klient i adres</span>
        <span>Status</span>
        <span className="text-right">Ilość</span>
        <span className="text-right">Wartość</span>
        <span />
      </div>

      {routes.map((route) => (
        <div key={route.route_id ?? 'none'} role="group" aria-label={route.route_name}>
          <h2 className="m-0 px-4 md:px-5 py-2.5 bg-[#efebe9] border-t border-[#e2dcda] flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
            <span className="text-xs font-extrabold uppercase tracking-[0.06em] text-[#3d3937]">
              {route.route_name}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4a4543]">
              <Truck aria-hidden className="w-3.5 h-3.5" />
              {route.driver_name ?? 'bez kierowcy'}
            </span>
            <span className="text-xs font-bold text-[#5f5a58]">
              · {route.stops.length} {plural(route.stops.length, 'klient', 'klientów', 'klientów')} ·{' '}
              {formatPieces(route.total_quantity)} · {formatMoney(route.total_amount)}
            </span>
            <Link
              to={`/orders/print?date=${date}&route=${printRouteParam(route.route_id)}`}
              target="_blank"
              className="ml-auto inline-flex items-center gap-1.5 min-h-8 px-2.5 rounded-lg text-xs font-extrabold text-[#3d3937] hover:bg-[#e2dcda]"
            >
              <Printer aria-hidden className="w-3.5 h-3.5" />
              Lista załadunkowa
            </Link>
          </h2>
          <ul className="m-0 p-0 list-none">
            {route.stops.map((stop) => (
              <StopRow key={stop.id} stop={stop} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}