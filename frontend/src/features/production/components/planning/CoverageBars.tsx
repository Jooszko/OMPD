import { CircleCheck, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { CoverageRow } from '../../../../services/api';
import { plural } from '../../../home/lib/home';
import { coverageProgress, formatPieces, splitCoverage } from '../../lib/planning';

const SHORT_COLOR = '#e5484d';
const DONE_COLOR = '#3fb565';
const PENDING_COLOR = '#5b9be6';

function CoverageItem({ row }: { row: CoverageRow }) {
  const progress = coverageProgress(row);
  const short = row.shortfall > 0;
  const color = short ? SHORT_COLOR : progress >= 1 ? DONE_COLOR : PENDING_COLOR;
  return (
    <li className="flex flex-col gap-1.5 px-4 sm:px-6 py-3 border-t border-[#e6e1df]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-extrabold truncate">{row.product_name}</span>
        <span className="shrink-0 text-sm font-extrabold tabular-nums">
          {row.finished_qty} / {row.ordered_qty}
        </span>
      </div>
      <span
        role="img"
        aria-label={`${row.product_name}: gotowe ${row.finished_qty} z ${row.ordered_qty}${short ? `, brakuje ${row.shortfall}` : ''}`}
        className="relative block h-2 w-full rounded-full bg-[#ece7e5]"
      >
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${progress * 100}%`, background: color }} />
      </span>
      <span className="flex flex-wrap justify-between gap-x-3 text-xs font-semibold text-[#5f5a58] tabular-nums">
        <span>
          przewidywane {row.expected_qty}
          {row.waste_qty > 0 && ` · strata ${row.waste_qty}`}
        </span>
        {short && <span className="font-extrabold text-[#a32a2a]">brakuje {formatPieces(row.shortfall)}</span>}
      </span>
    </li>
  );
}

export function CoverageBars({ coverage }: { coverage: CoverageRow[] }) {
  const [showCovered, setShowCovered] = useState(false);
  const { short, covered } = splitCoverage(coverage);

  return (
    <section aria-labelledby="coverage-title" className="flex-[1_1_360px] min-w-0 rounded-[18px] bg-bakery-card border border-bakery-btnBorder overflow-hidden self-start">
      <div className="flex flex-col gap-0.5 px-4 sm:px-6 pt-5 pb-4">
        <h2 id="coverage-title" className="m-0 text-lg font-extrabold">Pokrycie zamówień</h2>
        <span className="text-xs font-semibold text-[#5f5a58]">
          Gotowe sztuki na magazynie względem zamówionych, po odjęciu strat.
        </span>
      </div>

      {short.length === 0 ? (
        <p className="m-0 flex items-center gap-2 px-4 sm:px-6 py-3 border-t border-[#e6e1df] text-sm font-extrabold text-[#1f7a3a]">
          <CircleCheck aria-hidden className="size-5" /> Wszystkie zamówienia będą pokryte.
        </p>
      ) : (
        <ul className="m-0 p-0 list-none">
          {short.map((row) => (
            <CoverageItem key={row.product_id} row={row} />
          ))}
        </ul>
      )}

      {covered.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={showCovered}
            onClick={() => setShowCovered((value) => !value)}
            className="w-full flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-0 border-t border-[#e6e1df] bg-transparent text-left text-[13px] font-extrabold text-bakery-dark cursor-pointer hover:bg-white"
          >
            <span className="inline-flex items-center gap-2">
              <span aria-hidden className="size-2 rounded-full" style={{ background: DONE_COLOR }} />
              Pokryte: {covered.length} {plural(covered.length, 'wyrób', 'wyroby', 'wyrobów')}
            </span>
            <ChevronDown aria-hidden className={`size-4 transition-transform ${showCovered ? 'rotate-180' : ''}`} />
          </button>
          {showCovered && (
            <ul className="m-0 p-0 list-none">
              {covered.map((row) => (
                <CoverageItem key={row.product_id} row={row} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
