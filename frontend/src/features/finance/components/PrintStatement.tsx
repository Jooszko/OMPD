import { createPortal } from 'react-dom';
import type { Statement } from '../../../services/api';
import { formatMoney } from '../lib/money';
import { StatementTable } from './StatementTable';

function formatPct(value: number | null): string {
  return value === null ? '—' : `${value.toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%`;
}

/** Print-only copy of the statement, rendered next to the app root and shown only when printing. */
export function PrintStatement({ statement }: { statement: Statement }) {
  const { period } = statement;
  const printedAt = new Date().toLocaleString('pl-PL', { dateStyle: 'long', timeStyle: 'short' });

  return createPortal(
    <div className="print-root font-auth text-bakery-dark bg-white">
      <header className="flex items-end justify-between gap-4 pb-3 mb-4 border-b-2 border-bakery-dark">
        <div>
          <p className="m-0 text-xs font-extrabold uppercase tracking-[0.1em] text-[#5f5a58]">Piekarnia OMPD</p>
          <h1 className="m-0 font-display text-2xl font-extrabold">Rachunek zysków i strat – {period.label}</h1>
          <p className="m-0 mt-1 text-xs text-[#4a4543]">
            Porównanie z okresem: {period.previous_label}
            {!period.is_complete && ' · okres trwa, stan na dzień wydruku'}
          </p>
        </div>
        <p className="m-0 text-xs text-[#4a4543] text-right">Wydrukowano: {printedAt}</p>
      </header>

      <StatementTable statement={statement} printable />

      <dl className="grid grid-cols-3 gap-4 mt-5 text-sm">
        <div>
          <dt className="text-xs text-[#5f5a58]">Marża brutto</dt>
          <dd className="m-0 font-extrabold tabular-nums">
            {formatMoney(statement.gross_margin, { cents: true })} ({formatPct(statement.gross_margin_pct)})
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[#5f5a58]">Zysk netto</dt>
          <dd className="m-0 font-extrabold tabular-nums">
            {formatMoney(statement.totals.net_profit, { cents: true })} ({formatPct(statement.net_margin_pct)})
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[#5f5a58]">Okres</dt>
          <dd className="m-0 font-extrabold tabular-nums">
            {period.start} – {period.end}
          </dd>
        </div>
      </dl>

      <p className="mt-8 text-[11px] text-[#5f5a58]">
        Koszt surowców liczony z receptur produktów i ostatnich cen u dostawców. Kwoty w złotych. Dokument wygenerowany
        w systemie OMPD.
      </p>
    </div>,
    document.body
  );
}