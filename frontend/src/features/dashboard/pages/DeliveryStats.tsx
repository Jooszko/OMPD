import { type ReactNode, useEffect, useState } from 'react';
import { AlertTriangle, CircleCheck, Hourglass, Percent } from 'lucide-react';
import { fetchDeliveryStats, type DeliveryStats } from '../../../services/api';
import { shiftIsoDate, toIsoDate } from '../lib/dateFormat';
import { formatPercent } from '../lib/statsFormat';
import { DailyDeliveriesChart } from '../components/DailyDeliveriesChart';
import { HorizontalBarList } from '../components/HorizontalBarList';

const PRESETS = [7, 30, 90] as const;

const TILE_TONES = {
  emerald: 'bg-emerald-100 border-emerald-200 text-emerald-700',
  rose: 'bg-rose-100 border-rose-200 text-rose-700',
  slate: 'bg-slate-100 border-slate-200 text-slate-700',
  amber: 'bg-amber-100 border-amber-200 text-amber-700',
};

interface LoadedStats {
  key: string;
  stats: DeliveryStats | null;
  error: string | null;
}

function presetRange(days: number) {
  const end = toIsoDate(new Date());
  return { start: shiftIsoDate(end, -(days - 1)), end };
}

function StatTile({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone: keyof typeof TILE_TONES;
}) {
  return (
    <div className="bg-bakery-inactive border border-bakery-btnBorder p-4 rounded shadow-sm flex items-center gap-4">
      <div className={`w-10 h-10 border rounded-lg flex items-center justify-center shrink-0 ${TILE_TONES[tone]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <span className="text-[10px] font-bold text-gray-500 uppercase block tracking-wider">{label}</span>
        <p className="text-xl font-black text-bakery-dark font-mono m-0">{value}</p>
        {hint && <p className="m-0 text-[11px] text-gray-500 font-medium">{hint}</p>}
      </div>
    </div>
  );
}

const PROBLEM_BAR_COLOR = '#e11d48';

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
    <section
      className={`bg-bakery-inactive border border-bakery-btnBorder rounded shadow-sm p-4 flex flex-col gap-3 ${className}`}
    >
      <div>
        <h2 className="m-0 text-sm font-bold text-bakery-dark">{title}</h2>
        {subtitle && <p className="m-0 text-[11px] text-gray-500 font-medium">{subtitle}</p>}
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
    <div className="w-full max-w-7xl mx-auto px-8 py-6 flex flex-col gap-5 text-bakery-dark">
      <div>
        <h1 className="m-0 mb-1 text-2xl font-bold tracking-tight text-bakery-dark">Statystyki dostaw</h1>
        <p className="text-xs text-gray-500 font-medium">
          Skuteczność dostaw, przyczyny problemów i praca kierowców w wybranym okresie. Liczone są przystanki (klient w
          danym dniu), a nie pojedyncze pozycje zamówień.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => choosePreset(days)}
            aria-pressed={activePreset === days}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition active:scale-[0.98] ${
              activePreset === days
                ? 'bg-bakery-dark text-white border-bakery-dark'
                : 'bg-white text-bakery-dark border-bakery-btnBorder hover:bg-bakery-inactive'
            }`}
          >
            {days} dni
          </button>
        ))}
        <span className="mx-1 text-xs text-gray-400" aria-hidden>
          |
        </span>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
          od
          <input
            type="date"
            value={range.start}
            max={today}
            onChange={(e) => changeDate('start', e.target.value)}
            className="px-2 py-1 text-xs font-semibold bg-white border border-bakery-btnBorder rounded-lg outline-none focus:border-bakery-accent"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
          do
          <input
            type="date"
            value={range.end}
            max={today}
            onChange={(e) => changeDate('end', e.target.value)}
            className="px-2 py-1 text-xs font-semibold bg-white border border-bakery-btnBorder rounded-lg outline-none focus:border-bakery-accent"
          />
        </label>
      </div>

      <hr className="border-0 border-t border-bakery-border my-1" />

      {rangeError && <p className="m-0 text-sm font-semibold text-rose-700">{rangeError}</p>}
      {!rangeError && current?.error && (
        <p className="m-0 text-sm font-semibold text-rose-700">Nie udało się pobrać statystyk: {current.error}</p>
      )}
      {!rangeError && !current && !stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" aria-label="Wczytywanie statystyk">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[76px] rounded border border-bakery-btnBorder bg-bakery-inactive animate-pulse" />
          ))}
        </div>
      )}

      {stats && (
        <div
          className={`flex flex-col gap-5 transition-opacity ${isRefetching ? 'opacity-50' : ''}`}
          aria-busy={isRefetching}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatTile
              icon={<Percent className="w-6 h-6" />}
              label="Skuteczność"
              value={formatPercent(stats.summary.success_rate)}
              hint={`${stats.summary.delivered} z ${handled} obsłużonych przystanków`}
              tone="emerald"
            />
            <StatTile
              icon={<CircleCheck className="w-6 h-6" />}
              label="Dostarczone"
              value={String(stats.summary.delivered)}
              tone="slate"
            />
            <StatTile
              icon={<AlertTriangle className="w-6 h-6" />}
              label="Nieudane"
              value={String(stats.summary.failed)}
              tone="rose"
            />
            <StatTile
              icon={<Hourglass className="w-6 h-6" />}
              label="W toku"
              value={String(stats.summary.pending)}
              hint="jeszcze nieobsłużone (np. dzisiejsze)"
              tone="amber"
            />
          </div>

          {isEmpty ? (
            <p className="m-0 text-sm font-semibold text-gray-500 italic">Brak dostaw w wybranym okresie.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}