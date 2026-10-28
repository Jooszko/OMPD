import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PlanPreview } from '../../../../services/api';
import { formatQty } from '../../../warehouse/lib/warehouse';
import { ingredientNeeds, NEED_COLORS, NEED_LABELS, needBar, type IngredientNeed, type NeedState } from '../../lib/planning';

const STOCK_COLOR = '#d9d2cf';
const NEED_COLOR = '#1a1a1a';

function NeedRow({ need }: { need: IngredientNeed }) {
  const bar = needBar(need);
  return (
    <li
      tabIndex={0}
      aria-label={`${need.name}: potrzeba ${formatQty(need.amount, need.unit)}, na stanie ${formatQty(need.current, need.unit)}, minimum ${formatQty(need.minimum, need.unit)}. ${NEED_LABELS[need.state]}.`}
      className={`flex flex-col gap-1.5 px-4 sm:px-6 py-3 border-t border-[#e6e1df] outline-none transition-colors hover:bg-white focus-visible:bg-white`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="inline-flex items-center gap-2 min-w-0">
          <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: NEED_COLORS[need.state] }} />
          <span className="text-sm font-extrabold truncate">{need.name}</span>
        </span>
        <span className="shrink-0 text-sm font-extrabold tabular-nums">{formatQty(need.amount, need.unit)}</span>
      </div>
      <span aria-hidden className="relative block h-3 w-full rounded-full bg-[#f3efed]">
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${bar.current * 100}%`, background: STOCK_COLOR }} />
        <span
          className="absolute inset-y-0.5 left-0.5 rounded-full"
          style={{
            width: `calc(${Math.min(bar.amount, 1) * 100}% - 4px)`,
            background: need.state === 'shortage' ? NEED_COLORS.shortage : NEED_COLOR,
          }}
        />
        {need.minimum > 0 && (
          <span className="absolute -top-1 -bottom-1 w-0.5 rounded-full" style={{ left: `${bar.minimum * 100}%`, background: NEED_COLORS.below_min }} />
        )}
      </span>
      <span className="flex flex-wrap justify-between gap-x-3 text-xs font-semibold text-[#5f5a58] tabular-nums">
        <span>
          na stanie {formatQty(need.current, need.unit)} · minimum {formatQty(need.minimum, need.unit)}
        </span>
        <span className={need.state === 'ok' ? '' : 'font-extrabold text-bakery-dark'}>
          {need.state === 'shortage'
            ? `brakuje ${formatQty(-need.after, need.unit)}`
            : `zostanie ${formatQty(need.after, need.unit)}`}
        </span>
      </span>
    </li>
  );
}

export function IngredientNeeds({ rows }: { rows: PlanPreview['ingredient_totals'] }) {
  const needs = ingredientNeeds(rows);
  const counts = needs.reduce<Record<NeedState, number>>(
    (acc, need) => ({ ...acc, [need.state]: acc[need.state] + 1 }),
    { shortage: 0, below_min: 0, ok: 0 }
  );

  return (
    <section aria-labelledby="needs-title" className="flex-[1_1_420px] min-w-0 rounded-[18px] bg-bakery-card border border-bakery-btnBorder overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 sm:px-6 pt-5 pb-4">
        <div className="flex flex-col gap-0.5">
          <h2 id="needs-title" className="m-0 text-lg font-extrabold">Surowce na zmianę</h2>
          <span className="text-xs font-semibold text-[#5f5a58]">
            {counts.shortage > 0
              ? `${counts.shortage} brakuje na tę zmianę`
              : counts.below_min > 0
                ? `${counts.below_min} po zmianie spadnie poniżej minimum`
                : 'Wszystkie surowce wystarczą z zapasem.'}
          </span>
        </div>
        <Link
          to="/warehouse"
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-bakery-btnBorder bg-white text-[13px] font-extrabold text-bakery-dark no-underline hover:border-bakery-dark"
        >
          Magazyn <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 sm:px-6 pb-3 text-xs font-semibold text-[#3d3937]">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="w-3 h-3 rounded-[3px]" style={{ background: NEED_COLOR }} /> Potrzeba na zmianę
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="w-3 h-3 rounded-[3px]" style={{ background: STOCK_COLOR }} /> Na stanie
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="w-0.5 h-3 rounded-full" style={{ background: NEED_COLORS.below_min }} /> Minimum
        </span>
      </div>
      <ul className="m-0 p-0 list-none">
        {needs.map((need) => (
          <NeedRow key={need.id} need={need} />
        ))}
      </ul>
    </section>
  );
}
