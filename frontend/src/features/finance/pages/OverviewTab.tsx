import { useEffect, useState } from 'react';
import { fetchFinanceOverview, type FinanceOverview } from '../../../services/api';
import { CostStructure } from '../components/CostStructure';
import { KpiCard } from '../components/KpiCard';
import { RevenueCostChart } from '../components/RevenueCostChart';
import { RecentExpenses } from '../components/RecentExpenses';
import { TopClients } from '../components/TopClients';
import { changeVsPrevious, formatMoney, formatShare } from '../lib/money';
import { comparisonLabel } from '../lib/period';
import { useFinancePeriod } from '../lib/financeContext';

interface LoadedOverview {
  key: string;
  overview: FinanceOverview | null;
  error: string | null;
}

export default function OverviewTab() {
  const period = useFinancePeriod();
  const [loaded, setLoaded] = useState<LoadedOverview | null>(null);
  const key = `${period.start}|${period.end}`;

  useEffect(() => {
    let cancelled = false;
    fetchFinanceOverview(period.start, period.end)
      .then((overview) => {
        if (!cancelled) setLoaded({ key, overview, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setLoaded({ key, overview: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [period.start, period.end, key]);

  const current = loaded?.key === key ? loaded : null;
  const overview = loaded?.overview ?? null;
  const isRefetching = !current && overview !== null;

  if (current?.error) {
    return <p className="m-0 text-sm font-semibold text-rose-700">Nie udało się pobrać danych finansowych: {current.error}</p>;
  }

  if (!overview) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Wczytywanie danych finansowych">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[150px] rounded-[14px] border border-bakery-btnBorder bg-bakery-inactive animate-pulse" />
        ))}
      </div>
    );
  }

  const { totals, previous_totals: previous } = overview;
  const comparison = comparisonLabel(overview.period.start, overview.period.end);
  const returns = Number(totals.returns);
  const profit = Math.round(Number(totals.net_profit));

  return (
    <div className={`flex flex-col gap-5 transition-opacity ${isRefetching ? 'opacity-50' : ''}`} aria-busy={isRefetching}>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Przychód netto"
          value={formatMoney(totals.revenue)}
          change={changeVsPrevious(totals.revenue, previous.revenue, 'income')}
          comparison={comparison}
          hint={
            returns > 0
              ? `sprzedaż ${formatMoney(totals.sales)} · zwroty −${formatMoney(totals.returns)}`
              : 'bez zwrotów w tym okresie'
          }
        />
        <KpiCard
          label="Koszt surowców"
          value={formatMoney(totals.cogs)}
          change={changeVsPrevious(totals.cogs, previous.cogs, 'cost')}
          comparison={comparison}
          hint={`${formatShare(totals.cogs, totals.revenue)} przychodu netto`}
        />
        <KpiCard
          label="Koszty operacyjne"
          value={formatMoney(totals.operating_expenses)}
          change={changeVsPrevious(totals.operating_expenses, previous.operating_expenses, 'cost')}
          comparison={comparison}
          hint="wynagrodzenia, czynsz, media, paliwo i inne"
        />
        <KpiCard
          label="Zysk netto"
          value={formatMoney(totals.net_profit)}
          change={changeVsPrevious(totals.net_profit, previous.net_profit, 'income')}
          comparison={comparison}
          hint={`marża netto ${formatShare(totals.net_profit, totals.revenue)}`}
          balance={profit > 0 ? 'profit' : profit < 0 ? 'loss' : undefined}
        />
      </div>
      <RevenueCostChart days={overview.daily} />

      <CostStructure rows={overview.cost_structure} revenue={totals.revenue} />

      <div className="flex flex-wrap items-start gap-4">
        <TopClients
          clients={overview.top_clients}
          others={overview.other_clients}
          revenue={totals.revenue}
          comparison={comparison}
        />
        <RecentExpenses expenses={overview.recent_expenses} />
      </div>
    </div>
  );
}