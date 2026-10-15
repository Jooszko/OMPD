import { useEffect, useState } from 'react';
import {
  closeDay,
  fetchClosings,
  fetchStatement,
  reopenDay,
  type ClosingDay,
  type ReportPeriodKind,
  type Statement,
} from '../../../services/api';
import { toIsoDate } from '../../dashboard/lib/dateFormat';
import { ClosingsTable } from '../components/ClosingsTable';
import { DayCalendar } from '../components/DayCalendar';
import { KpiCard } from '../components/KpiCard';
import { ReportPeriodNav } from '../components/ReportPeriodNav';
import { StatementTable } from '../components/StatementTable';
import { TrendChart } from '../components/TrendChart';
import { changeVsPrevious, formatMoney } from '../lib/money';

interface LoadedReports {
  key: string;
  statement: Statement | null;
  closings: ClosingDay[];
  error: string | null;
}

function pct(value: number | null): string {
  return value === null ? '—' : `${value.toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%`;
}

export default function ReportsTab() {
  const today = toIsoDate(new Date());
  const [kind, setKind] = useState<ReportPeriodKind>('month');
  const [anchor, setAnchor] = useState(today);
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<LoadedReports | null>(null);
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const key = `${kind}|${anchor}|${version}`;

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchStatement(kind, anchor), fetchClosings()])
      .then(([statement, closings]) => {
        if (!cancelled) setLoaded({ key, statement, closings, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setLoaded({ key, statement: null, closings: [], error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [kind, anchor, key]);

  const runClosing = async (date: string, action: (date: string) => Promise<unknown>) => {
    setBusyDate(date);
    setActionError(null);
    try {
      await action(date);
      setVersion((value) => value + 1);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Nie udało się zapisać zmiany.');
    } finally {
      setBusyDate(null);
    }
  };

  const current = loaded?.key === key ? loaded : null;
  const statement = loaded?.statement ?? null;
  const isRefetching = !current && statement !== null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ReportPeriodNav
          kind={kind}
          anchor={anchor}
          today={today}
          label={statement?.period.label ?? null}
          onKindChange={setKind}
          onAnchorChange={setAnchor}
        />
        {statement && !statement.period.is_complete && (
          <span className="text-[13px] font-bold text-[#4a4543]">Okres trwa – kwoty na dziś</span>
        )}
      </div>

      {current?.error && <p className="m-0 text-sm font-semibold text-rose-700">Nie udało się pobrać raportu: {current.error}</p>}
      {actionError && (
        <p role="alert" className="m-0 px-4 py-3 rounded-xl bg-[#fbdcdc] text-sm font-semibold text-[#991b1b]">
          {actionError}
        </p>
      )}

      {!statement && !current?.error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Wczytywanie raportu">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[140px] rounded-[14px] border border-bakery-btnBorder bg-bakery-inactive animate-pulse" />
          ))}
        </div>
      )}

      {statement && (
        <div className={`flex flex-col gap-5 transition-opacity ${isRefetching ? 'opacity-60' : ''}`} aria-busy={isRefetching}>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Przychód netto"
              value={formatMoney(statement.totals.revenue)}
              change={changeVsPrevious(statement.totals.revenue, statement.previous_totals.revenue, 'income')}
              comparison={`vs ${statement.period.previous_label}`}
            />
            <KpiCard
              label="Marża brutto"
              value={formatMoney(statement.gross_margin)}
              change={changeVsPrevious(statement.gross_margin, statement.previous_gross_margin, 'income')}
              comparison={`vs ${statement.period.previous_label}`}
              hint={`${pct(statement.gross_margin_pct)} przychodu`}
            />
            <KpiCard
              label="Koszty operacyjne"
              value={formatMoney(statement.totals.operating_expenses)}
              change={changeVsPrevious(statement.totals.operating_expenses, statement.previous_totals.operating_expenses, 'cost')}
              comparison={`vs ${statement.period.previous_label}`}
            />
            <KpiCard
              label="Zysk netto"
              value={formatMoney(statement.totals.net_profit)}
              change={changeVsPrevious(statement.totals.net_profit, statement.previous_totals.net_profit, 'income')}
              comparison={`vs ${statement.period.previous_label}`}
              hint={`marża netto ${pct(statement.net_margin_pct)}`}
              balance={
                Math.round(Number(statement.totals.net_profit)) > 0
                  ? 'profit'
                  : Math.round(Number(statement.totals.net_profit)) < 0
                    ? 'loss'
                    : undefined
              }
            />
          </div>

          <section className="bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm p-5 sm:p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="m-0 text-lg font-extrabold">Ostatnie okresy</h2>
              <p className="m-0 text-[13px] text-[#5f5a58]">Przychód netto i wszystkie koszty; wyróżniony jest wybrany okres.</p>
            </div>
            <TrendChart trend={statement.trend} />
          </section>

          <div className="flex flex-wrap items-start gap-4">
            <section className="flex-[999_1_600px] min-w-0 bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm p-5 sm:p-6 flex flex-col gap-3.5">
              <div className="flex flex-col gap-0.5">
                <h2 className="m-0 text-lg font-extrabold">Rachunek zysków i strat</h2>
                <p className="m-0 text-[13px] text-[#5f5a58]">
                  {statement.period.label} w porównaniu z okresem: {statement.period.previous_label}.
                </p>
              </div>
              <StatementTable statement={statement} />
            </section>
            {statement.period.kind === 'month' && <DayCalendar statement={statement} />}
          </div>

          <ClosingsTable
            days={loaded?.closings ?? []}
            today={today}
            busyDate={busyDate}
            onClose={(date) => runClosing(date, closeDay)}
            onReopen={(date) => runClosing(date, reopenDay)}
          />
        </div>
      )}
    </div>
  );
}