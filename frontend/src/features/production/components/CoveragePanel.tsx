import { AlertTriangle, CircleCheck } from 'lucide-react';
import type { CoverageRow } from '../../../services/api';
import { shortfallRows } from '../lib/productionStage';

/** Czy zamówienia zostaną pokryte po uwzględnieniu zgłoszonych strat (pasek na tablicy produkcji). */
export function CoveragePanel({ coverage }: { coverage: CoverageRow[] }) {
  const short = shortfallRows(coverage);

  return short.length === 0 ? (
    <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 text-white px-4 py-3 text-lg font-extrabold">
      <CircleCheck className="w-6 h-6" /> Zamówienia pokryte
    </span>
  ) : (
    <span className="inline-flex items-center gap-2 rounded-xl bg-red-700 text-white px-4 py-3 text-lg font-extrabold">
      <AlertTriangle className="w-6 h-6" /> Brakuje: {short.map((r) => `${r.product_name} ${r.shortfall} szt.`).join(', ')}
    </span>
  );
}
