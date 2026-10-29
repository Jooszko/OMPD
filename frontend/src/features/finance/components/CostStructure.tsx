import type { FinanceCostRow } from '../../../services/api';
import { categoryColors } from '../lib/categories';
import { changeVsPrevious, formatMoney, formatShare } from '../lib/money';
import { ChangeBadge } from './ChangeBadge';

function GroupTile({ label, amount, total, hint }: { label: string; amount: number; total: number; hint: string }) {
  return (
    <div className="px-[18px] py-4 rounded-xl bg-white border border-[#e6e1df] flex flex-col gap-1.5">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]">{label}</span>
      <span className="font-display text-[26px] font-extrabold tabular-nums">
        {formatMoney(amount)}
        <span className="font-auth text-sm font-bold text-[#5f5a58]"> · {formatShare(amount, total)}</span>
      </span>
      <span className="text-[13px] font-semibold text-[#4a4543]">{hint}</span>
    </div>
  );
}

export function CostStructure({ rows, revenue }: { rows: FinanceCostRow[]; revenue: string }) {
  const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);
  const cogs = rows.filter((row) => row.group === 'cogs').reduce((sum, row) => sum + Number(row.amount), 0);
  const visible = rows.filter((row) => Number(row.amount) > 0 || Number(row.previous) > 0);

  return (
    <section className="bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm p-5 sm:p-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="m-0 text-lg font-extrabold">Struktura kosztów</h2>
          <p className="m-0 text-[13px] text-[#5f5a58]">Na co poszły pieniądze w wybranym okresie.</p>
        </div>
        {total > 0 && (
          <span className="text-sm font-semibold text-[#4a4543] tabular-nums">
            Razem <strong className="text-bakery-dark">{formatMoney(total)}</strong> · {formatShare(total, revenue)}{' '}
            przychodu netto
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="m-0 text-sm font-semibold text-[#5f5a58] italic">Brak kosztów w tym okresie.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <GroupTile label="Surowce" amount={cogs} total={total} hint="Zużycie wg receptur i straty z magazynu." />
            <GroupTile
              label="Koszty operacyjne"
              amount={total - cogs}
              total={total}
              hint="Pensje, czynsz, media, paliwo – w większości stałe."
            />
          </div>

          <div aria-hidden className="flex gap-0.5 h-[22px] rounded-md overflow-hidden">
            {rows
              .filter((row) => Number(row.amount) > 0)
              .map((row) => (
                <span
                  key={row.key}
                  style={{ width: `${(Number(row.amount) / total) * 100}%`, background: categoryColors(row.key).color }}
                />
              ))}
          </div>

          <ul className="m-0 p-0 list-none grid grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2 sm:gap-3">
            {visible.map((row) => (
              <li
                key={row.key}
                className="px-3.5 py-2.5 sm:px-4 sm:py-3.5 rounded-xl bg-white border border-[#e6e1df] flex flex-wrap sm:flex-col items-center sm:items-stretch justify-between gap-x-3 gap-y-1 sm:gap-2"
              >
                <span className="flex items-center gap-2 text-[13px] font-extrabold">
                  <span
                    aria-hidden
                    className="w-3 h-3 rounded shrink-0"
                    style={{ background: categoryColors(row.key).color }}
                  />
                  {row.label}
                </span>
                <span className="text-base sm:text-xl font-extrabold tabular-nums">{formatMoney(row.amount)}</span>
                <span className="w-full sm:w-auto flex items-center justify-between gap-1.5 text-xs font-bold text-[#5f5a58] tabular-nums">
                  {formatShare(row.amount, total)} kosztów
                  <ChangeBadge change={changeVsPrevious(row.amount, row.previous, 'cost')} />
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}