import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Printer, Search } from 'lucide-react';
import { fetchOrderDay, type OrderDay, type OrderDayStop } from '../../../services/api';
import { apiErrorMessage } from '../../users/lib/staff';
import { filterRoutes, type StatusFilter } from '../lib/orders';
import { DateNav } from './DateNav';
import { DayNotices } from './DayNotices';
import { DayRoutes } from './DayRoutes';
import { DaySummary } from './DaySummary';
import { DeleteOrderDialog } from './DeleteOrderDialog';
import { OrderPanel } from './OrderPanel';
import { ProductTotals } from './ProductTotals';

export function DayView({ date, today, onDateChange }: { date: string; today: string; onDateChange: (date: string) => void }) {
  const [result, setResult] = useState<{ key: string; day?: OrderDay; error?: string } | null>(null);
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [deleting, setDeleting] = useState<OrderDayStop | null>(null);
  const [panel, setPanel] = useState<{ editing: OrderDayStop | null } | null>(null);

  const key = `${date}:${version}`;

  useEffect(() => {
    let cancelled = false;
    fetchOrderDay(date)
      .then((day: OrderDay) => {
        if (!cancelled) setResult({ key, day });
      })
      .catch((err: unknown) => {
        if (!cancelled) setResult({ key, error: apiErrorMessage(err, 'Nie udało się pobrać zamówień.') });
      });
    return () => {
      cancelled = true;
    };
  }, [date, key]);

  const current = result?.day?.date === date ? result.day : null;
  const loadError = result?.key === key ? (result.error ?? null) : null;
  const routes = useMemo(() => (current ? filterRoutes(current.routes, query, status) : []), [current, query, status]);

  const changeDate = (next: string) => {
    setStatus('all');
    onDateChange(next);
  };
  const reload = () => setVersion((value) => value + 1);

  return (
    <div className="flex flex-col gap-4">
      <DateNav date={date} today={today} onChange={changeDate} />

      {loadError && (
        <p role="alert" className="m-0 px-4 py-3 rounded-xl bg-[#fbdcdc] text-sm font-semibold text-[#991b1b]">
          {loadError}
        </p>
      )}

      {!current && !loadError && (
        <div className="flex flex-col gap-4" aria-label="Wczytywanie zamówień">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[100px] rounded-[14px] border border-bakery-btnBorder bg-bakery-inactive animate-pulse" />
            ))}
          </div>
          <div className="h-[420px] rounded-[14px] border border-bakery-btnBorder bg-bakery-inactive animate-pulse" />
        </div>
      )}

      {current && (
        <>
          <DayNotices day={current} onChanged={reload} />
          <DaySummary summary={current.summary} status={status} onStatusChange={setStatus} />
          <ProductTotals products={current.products} />

          <div className="flex flex-wrap gap-3">
            <label className="relative block flex-1 min-w-[240px]">
              <span className="sr-only">Szukaj klienta</span>
              <Search aria-hidden className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#8a8482]" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Szukaj klienta lub adresu…"
                className="w-full h-12 pl-11 pr-4 rounded-xl border-[1.5px] border-bakery-btnBorder bg-white text-[15px] font-semibold outline-none focus:border-bakery-accent"
              />
            </label>
            {current.routes.length > 0 && (
              <Link
                to={`/orders/print?date=${date}`}
                target="_blank"
                className="inline-flex items-center gap-2 h-12 px-4 rounded-xl border border-bakery-btnBorder bg-bakery-card text-sm font-extrabold hover:border-[#8f8a88]"
              >
                <Printer aria-hidden className="w-[18px] h-[18px]" />
                Drukuj trasy
              </Link>
            )}
            {!current.is_past && (
              <button
                type="button"
                onClick={() => setPanel({ editing: null })}
                className="inline-flex items-center gap-2 h-12 px-[18px] rounded-xl bg-bakery-dark text-white text-sm font-extrabold"
              >
                <Plus aria-hidden className="w-[18px] h-[18px] text-bakery-accent" strokeWidth={2.6} />
                Dodaj zamówienie
              </button>
            )}
          </div>

          {routes.length > 0 ? (
            <DayRoutes date={date} routes={routes} onEdit={(stop) => setPanel({ editing: stop })} onDelete={setDeleting} />

          ) : (
            <p className="m-0 px-5 py-8 rounded-[14px] border border-bakery-btnBorder bg-bakery-card text-center text-sm font-semibold text-[#5f5a58]">
              {current.summary.stops === 0 && current.routes.length === 0
                ? 'Na ten dzień nie ma zamówień.'
                : 'Żadne zamówienie nie pasuje do wyszukiwania.'}
            </p>
          )}
        </>
      )}

      {panel && current && (
        <OrderPanel
          date={date}
          stops={current.routes.flatMap((route) => route.stops)}
          editing={panel.editing}
          onClose={() => setPanel(null)}
          onSaved={reload}
        />
      )}

      {deleting && (
        <DeleteOrderDialog stop={deleting} date={date} onClose={() => setDeleting(null)} onDeleted={reload} />
      )}
    </div>
  );
}