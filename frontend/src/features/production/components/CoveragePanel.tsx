import { AlertTriangle, CircleCheck } from 'lucide-react';
import type { CoverageRow } from '../../../services/api';
import { shortfallRows } from '../lib/productionStage';

/** Czy zamówienia zostaną pokryte po uwzględnieniu zgłoszonych strat. */
export function CoveragePanel({ coverage, compact = false }: { coverage: CoverageRow[]; compact?: boolean }) {
  const short = shortfallRows(coverage);

  if (compact) {
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

  return (
    <div className="bg-bakery-inactive rounded border border-bakery-btnBorder shadow-sm overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-bakery-btnBorder text-[10px] font-bold uppercase tracking-wider">
            <th className="py-2 px-3">Wyrób</th>
            <th className="py-2 px-3 text-right">Zamówiono</th>
            <th className="py-2 px-3 text-right">Strata</th>
            <th className="py-2 px-3 text-right">Przewidywane</th>
            <th className="py-2 px-3 text-right">Na magazynie</th>
            <th className="py-2 px-3 text-right">Brak</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {coverage.map((row) => (
            <tr
              key={row.product_id}
              className={`border-b border-bakery-btnBorder ${row.shortfall > 0 ? 'bg-red-50' : 'bg-bakery-rowBg'}`}
            >
              <td className="py-2 px-3 font-semibold">{row.product_name}</td>
              <td className="py-2 px-3 text-right tabular-nums">{row.ordered_qty}</td>
              <td className="py-2 px-3 text-right tabular-nums">{row.waste_qty || '—'}</td>
              <td className="py-2 px-3 text-right tabular-nums">{row.expected_qty}</td>
              <td className="py-2 px-3 text-right tabular-nums">{row.finished_qty}</td>
              <td className={`py-2 px-3 text-right tabular-nums font-bold ${row.shortfall > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {row.shortfall > 0 ? row.shortfall : 'OK'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
