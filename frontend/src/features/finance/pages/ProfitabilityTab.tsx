import { useEffect, useState } from 'react';
import { fetchProfitability, type Profitability } from '../../../services/api';
import { MarginGroups } from '../components/MarginGroups';
import { MissingPrices } from '../components/MissingPrices';
import { useFinancePeriod } from '../lib/financeContext';
import { formatMoney } from '../lib/money';
import { groupByMargin, lowestMargin, profitRanking } from '../lib/profitability';

interface LoadedProfitability {
  key: string;
  data: Profitability | null;
  error: string | null;
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm p-5 flex flex-col gap-2 min-w-0">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]">{label}</span>
      <span className="font-display text-[26px] leading-tight font-extrabold tabular-nums truncate">{value}</span>
      <span className="text-[13px] font-semibold text-[#4a4543] tabular-nums">{hint}</span>
    </div>
  );
}

export default function ProfitabilityTab() {
  const period = useFinancePeriod();
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<LoadedProfitability | null>(null);
  const key = `${period.start}|${period.end}|${version}`;

  useEffect(() => {
    let cancelled = false;
    fetchProfitability(period.start, period.end)
      .then((data) => {
        if (!cancelled) setLoaded({ key, data, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setLoaded({ key, data: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [period.start, period.end, key]);

  const current = loaded?.key === key ? loaded : null;
  const data = loaded?.data ?? null;
  const isRefetching = !current && data !== null;

  if (current?.error) {
    return <p className="m-0 text-sm font-semibold text-rose-700">Nie udało się pobrać rentowności: {current.error}</p>;
  }

  if (!data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" aria-label="Wczytywanie rentowności">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[120px] rounded-[14px] border border-bakery-btnBorder bg-bakery-inactive animate-pulse" />
        ))}
      </div>
    );
  }

  const ranking = profitRanking(data.products);
  const best = ranking[0] ?? null;
  const lowest = lowestMargin(data.products);
  const leader = Math.max(1, ...ranking.map((product) => Number(product.period_margin)));

  return (
    <div className={`flex flex-col gap-5 transition-opacity ${isRefetching ? 'opacity-60' : ''}`} aria-busy={isRefetching}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="Średnia marża na surowcach"
          value={data.average_margin_pct !== null ? `${Math.round(data.average_margin_pct)}%` : '—'}
          hint="ważona sprzedażą, bez produktów z brakami cen"
        />
        <SummaryCard
          label="Najwięcej zarabia"
          value={best?.name ?? '—'}
          hint={best ? `${formatMoney(best.period_margin!)} marży w okresie` : 'brak sprzedaży w okresie'}
        />
        <SummaryCard
          label="Najniższa marża"
          value={lowest?.name ?? '—'}
          hint={
            lowest
              ? `${Math.round(lowest.margin_pct!)}% · tylko ${formatMoney(lowest.unit_margin!, { cents: true })} na sztuce`
              : 'brak pełnych danych'
          }
        />
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-[999_1_620px] min-w-0">
          <MarginGroups groups={groupByMargin(data.products)} />
        </div>

        <aside className="flex-[1_1_320px] min-w-0 flex flex-col gap-4">
          <MissingPrices items={data.missing_prices} onSaved={() => setVersion((value) => value + 1)} />

          <section className="bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm p-5 flex flex-col gap-3.5">
            <div className="flex flex-col gap-0.5">
              <h2 className="m-0 text-[17px] font-extrabold">Na czym zarabiamy najwięcej</h2>
              <p className="m-0 text-[13px] text-[#5f5a58]">Marża w okresie (produkty z pełnymi cenami)</p>
            </div>
            {ranking.length === 0 ? (
              <p className="m-0 text-sm font-semibold text-[#5f5a58] italic">Brak sprzedaży w tym okresie.</p>
            ) : (
              <ol className="m-0 p-0 list-none flex flex-col gap-3">
                {ranking.map((product) => (
                  <li key={product.product_id} className="flex flex-col gap-1.5">
                    <span className="flex justify-between gap-2 text-[13px] tabular-nums">
                      <span className="font-bold">{product.name}</span>
                      <span className="font-extrabold">{formatMoney(product.period_margin!)}</span>
                    </span>
                    <span aria-hidden className="h-2.5 rounded bg-bakery-rowBg">
                      <span
                        className="block h-full rounded bg-[#2a78d6]"
                        style={{ width: `${Math.max(0, (Number(product.period_margin) / leader) * 100)}%` }}
                      />
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm p-5 flex flex-col gap-2">
            <h2 className="m-0 text-base font-extrabold">Jak liczymy marżę</h2>
            <p className="m-0 text-[13px] leading-relaxed text-[#3d3937]">
              Koszt surowców to składniki z receptury produktu pomnożone przez ostatnią cenę u dostawcy (średnią, gdy
              dostawców jest kilku). Marża w okresie to przychód po zwrotach minus surowce wszystkich upieczonych sztuk.
              Nie obejmuje pracy, energii ani transportu – te koszty widać w zakładce Wydatki.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}