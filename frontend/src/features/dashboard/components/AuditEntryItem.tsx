import { useState } from 'react';
import { ChevronDown, History } from 'lucide-react';
import type { AuditEntry } from '../../../services/api';
import { formatTime } from '../lib/dateFormat';
import { formatAuditValue } from '../lib/auditFormat';

const CATEGORY_TONES: Record<AuditEntry['category'], string> = {
  accounts: 'bg-slate-100 border-slate-200 text-slate-700',
  clients: 'bg-sky-100 border-sky-200 text-sky-800',
  products: 'bg-amber-100 border-amber-200 text-amber-800',
  orders: 'bg-violet-100 border-violet-200 text-violet-800',
  finance: 'bg-emerald-100 border-emerald-200 text-emerald-800',
  logistics: 'bg-orange-100 border-orange-200 text-orange-800',
};

const WARNING_ACTIONS = new Set(['login.failed', 'login.locked', 'login.inactive_account', 'delivery.failed']);

export function AuditEntryItem({
  entry,
  onShowHistory,
}: {
  entry: AuditEntry;
  onShowHistory: (entry: AuditEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasDetails = entry.changes.length > 0 || entry.ip_address !== null;

  return (
    <li className="border-t border-bakery-btnBorder first:border-t-0">
      <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 py-3">
        <time dateTime={entry.created_at} className="w-12 shrink-0 pt-0.5 text-xs font-mono font-semibold text-gray-500">
          {formatTime(entry.created_at)}
        </time>

        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded ${CATEGORY_TONES[entry.category]}`}
            >
              {entry.category_label}
            </span>
            <span
              className={`text-sm font-bold ${WARNING_ACTIONS.has(entry.action) ? 'text-rose-700' : 'text-bakery-dark'}`}
            >
              {entry.action_label}
            </span>
            {entry.object_label &&
              (entry.object_type ? (
                <button
                  type="button"
                  onClick={() => onShowHistory(entry)}
                  title="Pokaż historię tego obiektu"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 underline decoration-dotted underline-offset-2 hover:text-bakery-dark"
                >
                  <History className="w-3.5 h-3.5" aria-hidden />
                  {entry.object_label}
                </button>
              ) : (
                <span className="text-xs font-semibold text-gray-600">{entry.object_label}</span>
              ))}
          </div>
          <p className="m-0 text-sm text-bakery-dark break-words">{entry.description}</p>
          <p className="m-0 text-[11px] font-medium text-gray-500">{entry.actor_name || 'System'}</p>
        </div>

        {hasDetails && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="self-start inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-bakery-dark bg-white border border-bakery-btnBorder rounded-lg hover:bg-bakery-inactive"
          >
            {entry.changes.length > 0 ? `Zmiany (${entry.changes.length})` : 'Szczegóły'}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        )}
      </div>

      {open && (
        <div className="mb-3 sm:ml-16 p-3 flex flex-col gap-2 bg-white border border-bakery-btnBorder rounded-lg">
          {entry.changes.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-gray-500">
                    <th scope="col" className="py-1 pr-3 font-bold">
                      Pole
                    </th>
                    <th scope="col" className="py-1 pr-3 font-bold">
                      Było
                    </th>
                    <th scope="col" className="py-1 font-bold">
                      Jest
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entry.changes.map((change) => (
                    <tr key={change.field} className="border-t border-bakery-btnBorder align-top">
                      <th scope="row" className="py-1.5 pr-3 font-semibold text-bakery-dark">
                        {change.label}
                      </th>
                      <td className="py-1.5 pr-3 text-gray-500">{formatAuditValue(change.old)}</td>
                      <td className="py-1.5 font-semibold text-bakery-dark">{formatAuditValue(change.new)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {entry.ip_address && (
            <p className="m-0 text-[11px] text-gray-500">
              Adres IP: <span className="font-mono">{entry.ip_address}</span>
            </p>
          )}
        </div>
      )}
    </li>
  );
}