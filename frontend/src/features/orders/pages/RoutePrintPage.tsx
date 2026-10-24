import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { fetchOrderDay, type OrderDay, type OrderDayRoute } from '../../../services/api';
import { apiErrorMessage } from '../../users/lib/staff';
import { formatDayHeading, formatPieces, isIsoDate, toIsoDate } from '../lib/orders';
import { activeItems, printRouteParam, routeLoad, stopsInDrivingOrder } from '../lib/print';

const CELL = 'border border-[#bdb7b5] px-2 py-1.5 text-left align-top';

function RouteSheet({ route, date }: { route: OrderDayRoute; date: string }) {
  const stops = stopsInDrivingOrder(route);
  return (
    <section className="flex flex-col gap-5 break-after-page last:break-after-auto">
      <header className="flex items-end justify-between gap-4 border-b-2 border-bakery-dark pb-3">
        <div>
          <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#5f5a58]">Lista załadunkowa</p>
          <h1 className="m-0 font-display text-[28px] leading-tight font-extrabold">{route.route_name}</h1>
          <p className="m-0 text-sm font-bold">
            Kierowca: {route.driver_name ?? '—'} · <span className="first-letter:uppercase">{formatDayHeading(date)}</span>
          </p>
        </div>
        <p className="m-0 text-right text-sm font-bold">
          {stops.length} przystanków
          <br />
          {formatPieces(route.total_quantity)}
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <h2 className="m-0 text-xs font-extrabold uppercase tracking-[0.08em]">Do załadunku</h2>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className={CELL}>Produkt</th>
              <th className={`${CELL} w-24 text-right`}>Ilość</th>
              <th className={`${CELL} w-20 text-center`}>Załadowano</th>
            </tr>
          </thead>
          <tbody>
            {routeLoad(route).map((row) => (
              <tr key={row.product_id}>
                <td className={CELL}>{row.product_name}</td>
                <td className={`${CELL} text-right font-bold tabular-nums`}>{formatPieces(row.quantity)}</td>
                <td className={`${CELL} text-center`}>☐</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="m-0 text-xs font-extrabold uppercase tracking-[0.08em]">Przystanki w kolejności trasy</h2>
        <ol className="m-0 p-0 list-none flex flex-col">
          {stops.map((stop, index) => (
            <li key={stop.id} className="grid grid-cols-[32px_1fr_180px] gap-3 py-2.5 border-t border-[#bdb7b5] break-inside-avoid">
              <span className="size-7 rounded-full border-2 border-bakery-dark flex items-center justify-center text-[13px] font-extrabold">
                {index + 1}
              </span>
              <span className="flex flex-col gap-0.5 text-[13px]">
                <span className="text-[15px] font-extrabold">{stop.client_name}</span>
                <span className="font-semibold">
                  {stop.address}
                  {stop.phone && ` · tel. ${stop.phone}`}
                </span>
                <span>
                  {activeItems(stop)
                    .map((item) => `${item.product_name} ${item.qty}`)
                    .join(' · ')}
                </span>
              </span>
              <span className="self-end flex flex-col gap-1 text-[11px] font-bold text-[#5f5a58]">
                <span className="border-b border-bakery-dark h-6" />
                Odebrał(a), godzina
              </span>
            </li>
          ))}
        </ol>
      </div>

      <footer className="grid grid-cols-2 gap-8 pt-4 text-[11px] font-bold text-[#5f5a58]">
        <span className="flex flex-col gap-1">
          <span className="border-b border-bakery-dark h-6" />
          Podpis kierowcy
        </span>
        <span className="flex flex-col gap-1">
          <span className="border-b border-bakery-dark h-6" />
          Godzina wyjazdu
        </span>
      </footer>
    </section>
  );
}

export default function RoutePrintPage() {
  const [params] = useSearchParams();
  const dateParam = params.get('date');
  const date = isIsoDate(dateParam) ? dateParam : toIsoDate(new Date());
  const routeParam = params.get('route');
  const [result, setResult] = useState<{ day?: OrderDay; error?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOrderDay(date)
      .then((day) => {
        if (!cancelled) setResult({ day });
      })
      .catch((err: unknown) => {
        if (!cancelled) setResult({ error: apiErrorMessage(err, 'Nie udało się pobrać zamówień.') });
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const routes = (result?.day?.routes ?? []).filter(
    (route) => routeParam === null || printRouteParam(route.route_id) === routeParam
  );

  const title = `Lista załadunkowa – ${routes.length === 1 ? routes[0].route_name : 'Trasy'} – ${date}`;

  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <div className="min-h-screen bg-white font-auth text-bakery-dark">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-bakery-dark text-white">
        <span className="text-sm font-bold">Podgląd wydruku – sprawdź i kliknij „Drukuj” (A4, pionowo).</span>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={routes.length === 0}
          className="inline-flex items-center gap-2 min-h-10 px-4 rounded-[10px] bg-bakery-accent text-bakery-dark text-sm font-extrabold disabled:opacity-50"
        >
          <Printer aria-hidden className="w-4 h-4" />
          Drukuj
        </button>
      </div>

      <main className="max-w-[820px] mx-auto px-6 py-8 flex flex-col gap-10">
        {result?.error && <p role="alert" className="m-0 text-sm font-bold text-[#991b1b]">{result.error}</p>}
        {!result && <p className="m-0 text-sm font-semibold">Wczytywanie…</p>}
        {result?.day && routes.length === 0 && <p className="m-0 text-sm font-semibold">Brak zamówień do wydruku.</p>}
        {routes.map((route) => (
          <RouteSheet key={route.route_id ?? 'none'} route={route} date={date} />
        ))}
      </main>

      {routes.length > 0 &&
        createPortal(
          <div className="print-root font-auth text-bakery-dark bg-white">
            {routes.map((route) => (
              <RouteSheet key={route.route_id ?? 'none'} route={route} date={date} />
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}