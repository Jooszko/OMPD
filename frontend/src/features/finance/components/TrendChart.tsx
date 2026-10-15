import type { Statement } from '../../../services/api';
import { formatAxisMoney, niceRange } from '../lib/chart';
import { formatMoney } from '../lib/money';
import { compactMoney } from '../lib/reports';

const REVENUE_COLOR = '#2a78d6';
const COST_COLOR = '#eb6834';
const CHART_HEIGHT = 200;

export function TrendChart({ trend }: { trend: Statement['trend'] }) {
  const { max, ticks } = niceRange(trend.flatMap((item) => [Number(item.revenue), Number(item.costs)]));
  const height = (value: string) => `${(Math.max(0, Number(value)) / max) * 100}%`;
  const last = trend.length - 1;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2.5">
        <div aria-hidden className="relative w-14 shrink-0" style={{ height: CHART_HEIGHT }}>
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
        <div className="relative flex-1 min-w-0" style={{ height: CHART_HEIGHT }}>
          {ticks.map((tick) => (
            <div
              key={tick}
              aria-hidden
              className={`absolute inset-x-0 border-t ${tick === 0 ? 'border-[#8f8a88]' : 'border-[#e6e1df]'}`}
              style={{ top: `${100 - (tick / max) * 100}%` }}
            />
          ))}
          <ul className="absolute inset-0 m-0 p-0 list-none flex gap-2">
            {trend.map((item, index) => (
              <li
                key={item.start}
                aria-label={`${item.label}: przychód ${formatMoney(item.revenue)}, koszty ${formatMoney(item.costs)}, wynik ${formatMoney(item.net_profit)}`}
                className={`flex-1 min-w-0 h-full flex items-end justify-center gap-1 px-1 rounded-md ${
                  index === last ? 'bg-bakery-dark/5' : ''
                }`}
              >
                <span aria-hidden className="flex-1 max-w-9 rounded-t" style={{ height: height(item.revenue), background: REVENUE_COLOR }} />
                <span aria-hidden className="flex-1 max-w-9 rounded-t" style={{ height: height(item.costs), background: COST_COLOR }} />
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div aria-hidden className="flex gap-2 ml-[66px] tabular-nums">
        {trend.map((item, index) => {
          const profit = Math.round(Number(item.net_profit));
          return (
            <span key={item.start} className="flex-1 min-w-0 flex flex-col items-center gap-0.5 text-center">
              <span className={`text-xs font-extrabold ${index === last ? 'text-bakery-dark' : 'text-[#5f5a58]'}`}>{item.label}</span>
              <span className={`text-xs font-extrabold ${profit > 0 ? 'text-[#1f7a3a]' : profit < 0 ? 'text-[#b91c1c]' : 'text-[#5f5a58]'}`}>
                {compactMoney(profit)}
              </span>
            </span>
          );
        })}
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
        <span>Pod słupkami: wynik okresu</span>
      </div>
    </div>
  );
}