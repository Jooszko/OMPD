import { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { fetchStandingOrders, type StandingOrderGroup } from '../../../services/api';
import { apiErrorMessage } from '../../users/lib/staff';
import { formatMoney, formatPieces } from '../lib/orders';
import { WEEKDAY_LABELS, dayLoad, matchesStanding, weeklyTotals } from '../lib/standing';
import { StandingList } from './StandingList';
import { StandingPanel } from './StandingPanel';

export function StandingView() {
  const [result, setResult] = useState<{ version: number; orders?: StandingOrderGroup[]; error?: string } | null>(null);
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState('');
  const [panel, setPanel] = useState<{ editing: StandingOrderGroup | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStandingOrders()
      .then((orders) => {
        if (!cancelled) setResult({ version, orders: orders as StandingOrderGroup[] });
      })
      .catch((err: unknown) => {
        if (!cancelled) setResult({ version, error: apiErrorMessage(err, 'Nie udało się pobrać zamówień stałych.') });
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const orders = result?.orders ?? null;
  const loadError = result?.version === version ? (result.error ?? null) : null;
  const visible = useMemo(() => (orders ?? []).filter((order) => matchesStanding(order, query)), [orders, query]);
  const load = dayLoad(orders ?? []);
  const busiest = Math.max(...load, 1);
  const week = (orders ?? []).reduce(
    (sum, order) => {
      const totals = weeklyTotals(order);
      return { deliveries: sum.deliveries + order.days_ids.length, pieces: sum.pieces + totals.pieces, value: sum.value + totals.value };
    },
    { deliveries: 0, pieces: 0, value: 0 }
  );
  const tiles = [
    { label: 'Klienci', value: String(orders?.length ?? 0), hint: 'ze stałym zamówieniem' },
    { label: 'Dostawy', value: String(week.deliveries), hint: 'w tygodniu' },
    { label: 'Sztuki', value: formatPieces(week.pieces), hint: 'w tygodniu' },
    { label: 'Wartość', value: formatMoney(week.value), hint: 'w tygodniu' },
  ];

  return (
    <div className="flex flex-col gap-4">
      {loadError && (
        <p role="alert" className="m-0 px-4 py-3 rounded-xl bg-[#fbdcdc] text-sm font-semibold text-[#991b1b]">
          {loadError}
        </p>
      )}

      {!orders && !loadError && (
        <div className="flex flex-col gap-4" aria-label="Wczytywanie zamówień stałych">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[100px] rounded-[14px] border border-bakery-btnBorder bg-bakery-inactive animate-pulse" />
            ))}
          </div>
          <div className="h-[420px] rounded-[14px] border border-bakery-btnBorder bg-bakery-inactive animate-pulse" />
        </div>
      )}

      {orders && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tiles.map((tile) => (
              <div
                key={tile.label}
                className="px-4 py-3.5 rounded-[14px] border border-bakery-btnBorder bg-bakery-card shadow-sm flex flex-col gap-1.5"
              >
                <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]">{tile.label}</span>
                <span className="font-display text-[26px] leading-none font-extrabold tabular-nums">{tile.value}</span>
                <span className="text-xs font-bold text-[#5f5a58]">{tile.hint}</span>
              </div>
            ))}
          </div>

          <section className="px-4 py-3.5 rounded-[14px] border border-bakery-btnBorder bg-bakery-card shadow-sm flex flex-col gap-3">
            <h2 className="m-0 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]">
              Sztuki ze stałych zamówień w dniach tygodnia
            </h2>
            <div className="grid grid-cols-7 gap-2 items-end h-[120px]">
              {load.map((pieces, day) => (
                <div key={WEEKDAY_LABELS[day]} className="h-full flex flex-col justify-end items-center gap-1.5">
                  <span className="text-[11px] font-extrabold tabular-nums text-[#3d3937]">{pieces.toLocaleString('pl-PL')}</span>
                  <span
                    aria-hidden
                    className="w-full max-w-[56px] rounded-t-lg bg-bakery-accent"
                    style={{ height: `${Math.max(4, (pieces / busiest) * 70)}px` }}
                  />
                  <span className="text-xs font-extrabold">{WEEKDAY_LABELS[day]}</span>
                </div>
              ))}
            </div>
          </section>

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
            <button
              type="button"
              onClick={() => setPanel({ editing: null })}
              className="inline-flex items-center gap-2 h-12 px-[18px] rounded-xl bg-bakery-dark text-white text-sm font-extrabold"
            >
              <Plus aria-hidden className="w-[18px] h-[18px] text-bakery-accent" strokeWidth={2.6} />
              Dodaj zamówienie stałe
            </button>
          </div>

          {visible.length > 0 ? (
            <StandingList orders={visible} onSelect={(order) => setPanel({ editing: order })} />
          ) : (
            <p className="m-0 px-5 py-8 rounded-[14px] border border-bakery-btnBorder bg-bakery-card text-center text-sm font-semibold text-[#5f5a58]">
              {orders.length === 0 ? 'Nie ma jeszcze zamówień stałych.' : 'Żaden klient nie pasuje do wyszukiwania.'}
            </p>
          )}
        </>
      )}

      {panel && orders && (
        <StandingPanel
          orders={orders}
          editing={panel.editing}
          onClose={() => setPanel(null)}
          onSaved={() => setVersion((value) => value + 1)}
        />
      )}
    </div>
  );
}