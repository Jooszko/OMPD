import { useState } from 'react';
import type { FinanceOverviewDay } from '../../../services/api';
import { BUCKET_TITLES, bucketDays, bucketSizeFor, type Bucket, type BucketSize } from '../lib/buckets';
import { formatAxisMoney, niceRange } from '../lib/chart';
import { formatMoney } from '../lib/money';

const REVENUE_COLOR = '#2a78d6';
const COST_COLOR = '#eb6834';
const CHART_HEIGHT = 220;
const BUCKET_NAMES: Record<BucketSize, string> = { day: 'Dzień', week: 'Tydzień', month: 'Miesiąc' };

function resultClass(value: number): string {
  if (Math.round(value) > 0) return 'text-[#1f7a3a]';
  if (Math.round(value) < 0) return 'text-[#b91c1c]';
  return 'text-[#5f5a58]';
}

function shortMoney(value: number): string {
  const sign = Math.round(value) > 0 ? '+' : '';
  return `${sign}${formatAxisMoney(Math.round(value))}`;
}

export function RevenueCostChart({ days }: { days: FinanceOverviewDay[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const size = bucketSizeFor(days.length);
  const buckets = bucketDays(days, size);
  const { max, ticks } = niceRange(buckets.flatMap((bucket) => [bucket.revenue, bucket.costs]));
  const heightPct = (value: number) => `${(Math.max(0, value) / max) * 100}%`;
  const total = buckets.reduce((sum, bucket) => sum + bucket.result, 0);
  const active: Bucket | null = hovered === null ? null : buckets[hovered];
  const crowded = buckets.length > 7;

  return (
    <section className="bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm p-5 flex flex-col gap-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="m-0 text-base font-extrabold">Przychody i koszty {BUCKET_TITLES[size]}</h2>
          <p className="m-0 text-[13px] text-[#5f5a58]">
            Przychód netto obok wszystkich kosztów (surowce i koszty operacyjne). Pod słupkami wynik każdego okresu.
          </p>
        </div>
        <span className="text-[13px] font-extrabold tabular-nums">
          Wynik całego okresu: <span className={resultClass(total)}>{formatMoney(total)}</span>
        </span>
      </div>

      <div className="flex gap-2.5">
        <div aria-hidden className="relative w-10 sm:w-14 shrink-0" style={{ height: CHART_HEIGHT }}>
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2 text-[11px] font-semibold text-[#5f5a58] tabular-nums"
              style={{ top: `${100 - (tick / max) * 100}%` }}
            >
              {formatAxisMoney(tick)}
            </span>
          ))}
        </div>

        <div className="relative flex-1 min-w-0" style={{ height: CHART_HEIGHT }} onMouseLeave={() => setHovered(null)}>
          {ticks.map((tick) => (
            <div
              key={tick}
              aria-hidden
              className={`absolute inset-x-0 border-t ${tick === 0 ? 'border-[#8f8a88]' : 'border-[#e6e1df]'}`}
              style={{ top: `${100 - (tick / max) * 100}%` }}
            />
          ))}

          <div className="absolute inset-0 flex">
            {buckets.map((bucket, index) => (
              <button
                key={bucket.start}
                type="button"
                aria-label={`${bucket.label}: przychód ${formatMoney(bucket.revenue)}, koszty ${formatMoney(bucket.costs)}, wynik ${formatMoney(bucket.result)}`}
                onMouseEnter={() => setHovered(index)}
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered(null)}
                className={`flex-1 min-w-0 h-full flex items-end justify-center gap-[3px] px-1 border-0 rounded-md cursor-pointer focus-visible:outline-2 focus-visible:outline-bakery-accent focus-visible:-outline-offset-2 ${
                  hovered === index ? 'bg-bakery-dark/5' : 'bg-transparent'
                }`}
              >
                <span
                  aria-hidden
                  className="flex-1 max-w-7 rounded-t"
                  style={{ height: heightPct(bucket.revenue), background: REVENUE_COLOR }}
                />
                <span
                  aria-hidden
                  className="flex-1 max-w-7 rounded-t"
                  style={{ height: heightPct(bucket.costs), background: COST_COLOR }}
                />
              </button>
            ))}
          </div>

          {active && hovered !== null && (
            <div
              role="status"
              className="absolute top-2 z-10 w-64 px-3.5 py-3 rounded-[10px] bg-bakery-dark text-white text-xs flex flex-col gap-1.5 pointer-events-none"
              style={{
                left: `${((hovered + 0.5) / buckets.length) * 100}%`,
                transform: hovered >= buckets.length / 2 ? 'translateX(calc(-100% - 16px))' : 'translateX(16px)',
              }}
            >
              <span className="text-[13px] font-extrabold">
                {BUCKET_NAMES[size]} {active.label}
              </span>
              <TooltipRow label="Przychód netto" value={formatMoney(active.revenue)} />
              <TooltipRow label="Surowce" value={formatMoney(-active.cogs)} />
              <TooltipRow label="Koszty operacyjne" value={formatMoney(-active.operating)} />
              {active.expenses.slice(0, 4).map((expense) => (
                <TooltipRow
                  key={expense.label}
                  label={`· ${expense.label}`}
                  value={formatMoney(-expense.amount)}
                  muted
                />
              ))}
              <span className="flex justify-between gap-3 pt-1.5 mt-0.5 border-t border-[#3d3937] font-extrabold tabular-nums">
                <span>Wynik</span>
                <span>{formatMoney(active.result, { sign: true })}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      <div aria-hidden className="flex ml-[50px] sm:ml-[66px]">
        {buckets.map((bucket, index) => (
          <span
            key={bucket.start}
            className="flex-1 min-w-0 flex flex-col items-center gap-0.5 text-center tabular-nums"
          >
            <span
              className={`text-[10px] sm:text-[11px] leading-tight font-bold text-[#5f5a58] whitespace-nowrap ${
                crowded && index % 2 === 1 ? 'invisible sm:visible' : ''
              }`}
            >
              <BucketLabel label={bucket.label} />
            </span>
            {buckets.length <= 16 && (
              <span
                className={`text-[10px] sm:text-[11px] font-extrabold whitespace-nowrap ${resultClass(bucket.result)} ${
                  crowded ? 'hidden sm:block' : ''
                }`}
              >
                {shortMoney(bucket.result)}
              </span>
            )}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold text-[#3d3937]">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="w-3 h-3 rounded-[3px]" style={{ background: REVENUE_COLOR }} />
          Przychód netto
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="w-3 h-3 rounded-[3px]" style={{ background: COST_COLOR }} />
          Koszty razem
        </span>
        <span>
          Wynik: <span className="text-[#1f7a3a] font-extrabold">+ zysk</span> /{' '}
          <span className="text-[#b91c1c] font-extrabold">− strata</span>
        </span>
      </div>
    </section>
  );
}

function BucketLabel({ label }: { label: string }) {
  const [from, to] = label.split('–');
  if (to === undefined) return label;
  return (
    <>
      {from}–<br className="sm:hidden" />
      {to}
    </>
  );
}

function TooltipRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <span className={`flex justify-between gap-3 tabular-nums ${muted ? 'text-[#b8b0ab] pl-1' : 'text-[#e7e2df]'}`}>
      <span className="truncate">{label}</span>
      <span className={`whitespace-nowrap ${muted ? '' : 'font-bold text-white'}`}>{value}</span>
    </span>
  );
}