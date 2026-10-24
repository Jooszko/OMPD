import { useEffect, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, MapPin, Search } from 'lucide-react';
import { fetchOrderHistory, type OrderHistoryPage, type OrderHistoryStop } from '../../../services/api';
import { apiErrorMessage } from '../../users/lib/staff';
import { HISTORY_PRESETS, HISTORY_STATUSES, groupByDate, type HistoryFilters } from '../lib/history';
import { formatDayHeading, formatMoney, formatPieces, plural } from '../lib/orders';
import { StatusBadge } from './DayRoutes';

const CHIP = 'min-h-10 px-3.5 rounded-full border text-[13px] font-extrabold whitespace-nowrap';
const DATE_FIELD =
  'h-10 px-3 rounded-xl border-[1.5px] border-bakery-btnBorder bg-white text-[14px] font-semibold outline-none focus:border-bakery-accent';

function HistoryRow({ stop }: { stop: OrderHistoryStop }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-t border-[#e6e1df]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="w-full text-left flex md:grid md:grid-cols-[minmax(240px,1fr)_150px_110px_120px_24px] items-center gap-3 px-4 md:px-5 py-3 hover:bg-[#f3efed]"
      >
        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-[15px] font-extrabold">{stop.client_name}</span>
          <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#5f5a58]">
            <MapPin aria-hidden className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{stop.address}</span>
          </span>
          <span className="md:hidden mt-1 flex flex-wrap items-center gap-2 text-[13px] font-bold">
            <StatusBadge status={stop.status} />
            {formatPieces(stop.total_quantity)} · {formatMoney(stop.total_amount)}
          </span>
        </span>
        <span className="hidden md:block">
          <StatusBadge status={stop.status} />
        </span>
        <span className="hidden md:block text-right text-sm font-bold tabular-nums">{formatPieces(stop.total_quantity)}</span>
        <span className="hidden md:block text-right text-sm font-extrabold tabular-nums">{formatMoney(stop.total_amount)}</span>
        <ChevronDown aria-hidden className={`w-5 h-5 shrink-0 text-[#8a8482] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="m-0 mx-4 md:mx-5 mb-4 p-0 list-none rounded-xl border border-[#e2dcda] bg-white divide-y divide-[#eee9e7]">
          {stop.items.map((item) => (
            <li
              key={item.product_id}
              className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px] font-bold ${
                item.status === 'failed' || item.status === 'cancelled' ? 'text-[#8a8482] line-through' : ''
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
      )}
    </li>
  );
}

export function HistoryView({ today }: { today: string }) {
  const [filters, setFilters] = useState<HistoryFilters>(() => ({ ...HISTORY_PRESETS[1].range(today), status: 'all', page: 1 }));
  const [typed, setTyped] = useState('');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{ key: string; data?: OrderHistoryPage; error?: string } | null>(null);
  const key = JSON.stringify({ ...filters, query });

  useEffect(() => {
    const timer = setTimeout(() => setQuery(typed.trim()), 300);
    return () => clearTimeout(timer);
  }, [typed]);

  useEffect(() => {
    let cancelled = false;
    fetchOrderHistory({ ...filters, q: query })
      .then((data) => {
        if (!cancelled) setResult({ key, data });
      })
      .catch((err: unknown) => {
        if (!cancelled) setResult({ key, error: apiErrorMessage(err, 'Nie udało się pobrać historii zamówień.') });
      });
    return () => {
      cancelled = true;
    };
  }, [filters, query, key]);

  const update = (changes: Partial<HistoryFilters>) => setFilters((current) => ({ ...current, page: 1, ...changes }));
  const data = result?.data ?? null;
  const loadError = result?.key === key ? (result.error ?? null) : null;
  const loading = result?.key !== key;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 px-4 py-3.5 rounded-[14px] border border-bakery-btnBorder bg-bakery-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {HISTORY_PRESETS.map((preset) => {
            const range = preset.range(today);
            const active = range.date_from === filters.date_from && range.date_to === filters.date_to;
            return (
              <button
                key={preset.label}
                type="button"
                aria-pressed={active}
                onClick={() => update(range)}
                className={`${CHIP} ${
                  active ? 'bg-bakery-dark border-bakery-dark text-white' : 'bg-white border-bakery-btnBorder hover:border-[#8f8a88]'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
          <span className="flex items-center gap-2 text-[13px] font-bold">
            <input
              type="date"
              aria-label="Od"
              value={filters.date_from}
              max={filters.date_to}
              onChange={(event) => event.target.value && update({ date_from: event.target.value })}
              className={DATE_FIELD}
            />
            –
            <input
              type="date"
              aria-label="Do"
              value={filters.date_to}
              min={filters.date_from}
              onChange={(event) => event.target.value && update({ date_to: event.target.value })}
              className={DATE_FIELD}
            />
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="relative block flex-1 min-w-[220px]">
            <span className="sr-only">Szukaj klienta</span>
            <Search aria-hidden className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#8a8482]" />
            <input
              type="search"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder="Szukaj klienta…"
              className="w-full h-11 pl-11 pr-4 rounded-xl border-[1.5px] border-bakery-btnBorder bg-white text-[15px] font-semibold outline-none focus:border-bakery-accent"
            />
          </label>
        </div>
        <div role="group" aria-label="Status" className="flex flex-wrap gap-2">
          {HISTORY_STATUSES.map((option) => {
            const active = filters.status === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => update({ status: option.value })}
                className={`${CHIP} ${
                  active ? 'bg-bakery-dark border-bakery-dark text-white' : 'bg-white border-bakery-btnBorder hover:border-[#8f8a88]'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {filters.status === 'open' && (
          <p className="m-0 px-3.5 py-2.5 rounded-xl bg-[#fbe5bd] text-[13px] font-bold text-[#5c3300]">
            Minione zamówienia, których nikt nie oznaczył jako dostarczone, nieudane albo anulowane – do wyjaśnienia z
            kierowcą.
          </p>
        )}
        {data && (
          <p className="m-0 text-[13px] font-bold text-[#4a4543]">
            {data.summary.stops} {plural(data.summary.stops, 'dostawa', 'dostawy', 'dostaw')} ·{' '}
            {formatPieces(data.summary.pieces)} · {formatMoney(data.summary.value)} (bez nieudanych i anulowanych)
          </p>
        )}
      </section>

      {loadError && (
        <p role="alert" className="m-0 px-4 py-3 rounded-xl bg-[#fbdcdc] text-sm font-semibold text-[#991b1b]">
          {loadError}
        </p>
      )}

      {!data && !loadError && (
        <div aria-label="Wczytywanie historii" className="h-[420px] rounded-[14px] border border-bakery-btnBorder bg-bakery-inactive animate-pulse" />
      )}

      {data && data.results.length === 0 && (
        <p className="m-0 px-5 py-8 rounded-[14px] border border-bakery-btnBorder bg-bakery-card text-center text-sm font-semibold text-[#5f5a58]">
          Brak zamówień dla wybranych filtrów.
        </p>
      )}

      {data && data.results.length > 0 && (
        <section
          aria-busy={loading}
          className={`bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm overflow-hidden transition-opacity ${
            loading ? 'opacity-60' : ''
          }`}
        >
          {groupByDate(data.results).map((group) => (
            <div key={group.date} role="group" aria-label={formatDayHeading(group.date)}>
              <h2 className="m-0 px-4 md:px-5 py-2.5 bg-[#efebe9] border-t border-[#e2dcda] text-xs font-extrabold uppercase tracking-[0.06em] text-[#3d3937] first:border-t-0">
                {formatDayHeading(group.date)}
              </h2>
              <ul className="m-0 p-0 list-none">
                {group.stops.map((stop) => (
                  <HistoryRow key={stop.id} stop={stop} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {data && data.pages > 1 && (
        <nav aria-label="Strony historii" className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
            disabled={data.page <= 1}
            className="inline-flex items-center gap-1.5 min-h-10 px-3.5 rounded-xl border border-bakery-btnBorder bg-bakery-card text-[13px] font-extrabold disabled:opacity-40"
          >
            <ChevronLeft aria-hidden className="w-4 h-4" />
            Nowsze
          </button>
          <span className="text-[13px] font-bold tabular-nums">
            Strona {data.page} z {data.pages}
          </span>
          <button
            type="button"
            onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
            disabled={data.page >= data.pages}
            className="inline-flex items-center gap-1.5 min-h-10 px-3.5 rounded-xl border border-bakery-btnBorder bg-bakery-card text-[13px] font-extrabold disabled:opacity-40"
          >
            Starsze
            <ChevronRight aria-hidden className="w-4 h-4" />
          </button>
        </nav>
      )}
    </div>
  );
}