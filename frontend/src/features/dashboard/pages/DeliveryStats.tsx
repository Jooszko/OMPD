import { type ReactNode, useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { CalendarPicker } from '../../../components/ui/CalendarPicker';
import { fetchDeliveryStats, type DeliveryStats } from '../../../services/api';
import { shiftIsoDate, toIsoDate } from '../lib/dateFormat';
import { formatPercent } from '../lib/statsFormat';
import { DailyDeliveriesChart } from '../components/DailyDeliveriesChart';
import { HorizontalBarList } from '../components/HorizontalBarList';
import { DriversTable } from '../components/DriversTable';
import { ProofCoverage } from '../components/ProofCoverage';

const PRESETS = [7, 30, 90] as const;
const PROBLEM_BAR_COLOR = '#c62828';
const CHIP = 'min-h-10 px-3.5 rounded-full border text-[13px] font-extrabold whitespace-nowrap';
const DATE_FIELD =
  'inline-flex h-10 items-center gap-2 px-3 rounded-xl border-[1.5px] border-bakery-btnBorder bg-white text-[14px] font-semibold outline-none hover:border-[#8f8a88] focus-visible:outline-2 focus-visible:outline-bakery-accent';
const CARD = 'rounded-[14px] border border-bakery-btnBorder bg-bakery-card shadow-sm';
const ALERT = 'm-0 px-4 py-3 rounded-xl bg-[#fbdcdc] text-sm font-semibold text-[#991b1b]';

interface LoadedStats {
  key: string;
  stats: DeliveryStats | null;
  error: string | null;
}

function presetRange(days: number) {
  const end = toIsoDate(new Date());
  return { start: shiftIsoDate(end, -(days - 1)), end };
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year}`;
}

function StatTile({ label, value, hint, color = '' }: { label: string; value: string; hint: string; color?: string }) {
  return (
    <div className={`${CARD} px-4 py-3.5 flex flex-col gap-1.5`}>
      <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]">{label}</span>
      <span className={`font-display text-[26px] leading-none font-extrabold tabular-nums ${color}`}>{value}</span>
      <span className="text-xs font-bold text-[#5f5a58]">{hint}</span>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  className = '',
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${CARD} px-4 sm:px-5 py-4 flex flex-col gap-3.5 ${className}`}>
      <div className="flex flex-col gap-0.5">
        <h2 className="m-0 text-[15px] font-extrabold">{title}</h2>
        {subtitle && <p className="m-0 text-xs font-semibold text-[#5f5a58]">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export default function DeliveryStatsPage() {
  const [range, setRange] = useState(() => presetRange(30));
  const [activePreset, setActivePreset] = useState<number | null>(30);
  const [loaded, setLoaded] = useState<LoadedStats | null>(null);

  const today = toIsoDate(new Date());
  const rangeKey = `${range.start}|${range.end}`;
  const rangeError = range.start > range.end ? 'Data początkowa nie może być późniejsza niż końcowa.' : null;
  const current = loaded?.key === rangeKey ? loaded : null;
  const stats = loaded?.stats ?? null;
  const isRefetching = !rangeError && !current && stats !== null;

  useEffect(() => {
    if (rangeError) return;
    let cancelled = false;
    fetchDeliveryStats(range.start, range.end)
      .then((result) => {
        if (!cancelled) setLoaded({ key: rangeKey, stats: result, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setLoaded({ key: rangeKey, stats: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end, rangeKey, rangeError]);

  const choosePreset = (days: number) => {
    setActivePreset(days);
    setRange(presetRange(days));
  };

  const changeDate = (field: 'start' | 'end', value: string) => {
    if (!value) return;
    setActivePreset(null);
    setRange((previous) => ({ ...previous, [field]: value }));
  };

  const handled = stats ? stats.summary.delivered + stats.summary.failed : 0;
  const isEmpty = stats !== null && handled + stats.summary.pending === 0;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5 font-auth text-bakery-dark">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-display text-[34px] leading-none font-extrabold tracking-[-0.02em]">
          Statystyki dostaw
        </h1>
        <p className="m-0 text-sm text-[#4a4543]">
          Skuteczność dostaw, przyczyny problemów i praca kierowców. Liczone są przystanki (klient w danym dniu), a nie
          pojedyncze pozycje zamówień.
        </p>
      </div>

      <section className={`${CARD} px-4 py-3.5 flex flex-wrap items-center gap-2`}>
        {PRESETS.map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => choosePreset(days)}
            aria-pressed={activePreset === days}
            className={`${CHIP} ${
              activePreset === days
                ? 'bg-bakery-dark border-bakery-dark text-white'
                : 'bg-white border-bakery-btnBorder hover:border-[#8f8a88]'
            }`}
          >
            {days} dni
          </button>
        ))}
        <div className="flex items-center gap-2 text-[13px] font-bold">
          <CalendarPicker
            value={range.start}
            max={range.end}
            onChange={(date) => changeDate('start', date)}
            label="Wybierz datę początkową"
            triggerClassName={DATE_FIELD}
          >
            <CalendarDays aria-hidden className="size-4" />
            {formatDate(range.start)}
          </CalendarPicker>
          –
          <CalendarPicker
            value={range.end}
            min={range.start}
            max={today}
            onChange={(date) => changeDate('end', date)}
            label="Wybierz datę końcową"
            triggerClassName={DATE_FIELD}
          >
            <CalendarDays aria-hidden className="size-4" />
            {formatDate(range.end)}
          </CalendarPicker>
        </div>
      </section>

      {rangeError && <p className={ALERT}>{rangeError}</p>}
      {!rangeError && current?.error && <p className={ALERT}>Nie udało się pobrać statystyk: {current.error}</p>}
      {!rangeError && !current && !stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label="Wczytywanie statystyk">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[100px] rounded-[14px] border border-bakery-btnBorder bg-bakery-inactive animate-pulse"
            />
          ))}
        </div>
      )}

      {stats && (
        <div
          className={`flex flex-col gap-4 transition-opacity ${isRefetching ? 'opacity-60' : ''}`}
          aria-busy={isRefetching}
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile
              label="Skuteczność"
              value={formatPercent(stats.summary.success_rate)}
              hint={`${stats.summary.delivered} z ${handled} obsłużonych`}
              color="text-[#1f5f33]"
            />
            <StatTile label="Dostarczone" value={String(stats.summary.delivered)} hint="przystanków" />
            <StatTile label="Nieudane" value={String(stats.summary.failed)} hint="przystanków" color="text-[#b91c1c]" />
            <StatTile
              label="W toku"
              value={String(stats.summary.pending)}
              hint="jeszcze nieobsłużone"
              color="text-[#9a5b00]"
            />
          </div>

          {isEmpty ? (
            <p className={`${CARD} m-0 px-5 py-8 text-center text-sm font-semibold text-[#5f5a58]`}>
              Brak dostaw w wybranym okresie.
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard
                title="Przystanki dziennie"
                subtitle="Najedź na dzień albo użyj strzałek, aby zobaczyć liczby."
                className="lg:col-span-2"
              >
                <DailyDeliveriesChart days={stats.daily} />
              </ChartCard>
              <ChartCard title="Przyczyny nieudanych dostaw" subtitle="Liczba nieudanych przystanków według powodu.">
                <HorizontalBarList
                  items={stats.failure_reasons.map((r) => ({ key: r.reason, label: r.label, value: r.count }))}
                  color={PROBLEM_BAR_COLOR}
                  emptyText="Brak nieudanych dostaw w tym okresie."
                />
              </ChartCard>
              <ChartCard
                title="Klienci z największą liczbą problemów"
                subtitle="Liczba nieudanych przystanków u klienta (5 najczęstszych)."
              >
                <HorizontalBarList
                  items={stats.problem_clients.map((c) => ({ key: c.client_id, label: c.name, value: c.failed }))}
                  color={PROBLEM_BAR_COLOR}
                  emptyText="Brak nieudanych dostaw w tym okresie."
                />
              </ChartCard>
              <ChartCard
                title="Porównanie kierowców"
                subtitle="Czas w trasie: średnio dziennie, od pierwszej do ostatniej obsłużonej dostawy. Dni w trasie i przystanki liczone tylko z dni, w których kierowca obsłużył choć jeden przystanek."
                className="lg:col-span-2"
              >
                <DriversTable drivers={stats.drivers} />
              </ChartCard>
              <ChartCard
                title="Pokrycie potwierdzeniami"
                subtitle="Odsetek dostarczonych przystanków z danym rodzajem potwierdzenia. Jeden przystanek może mieć kilka rodzajów naraz."
                className="lg:col-span-2"
              >
                <ProofCoverage coverage={stats.proof_coverage} />
              </ChartCard>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
