import { useState } from 'react';
import { ChevronDown, History } from 'lucide-react';
import type { AuditEntry } from '../../../services/api';
import { formatTime } from '../lib/dateFormat';
import { formatAuditValue } from '../lib/auditFormat';

const CATEGORY_TONES: Record<AuditEntry['category'], string> = {
  accounts: 'bg-[#e6e1df] text-[#3d3937]',
  clients: 'bg-[#dfe8f6] text-[#1d4f91]',
  products: 'bg-[#fbe5bd] text-[#7a4300]',
  orders: 'bg-[#e6dcf6] text-[#4f3593]',
  finance: 'bg-[#dcefe0] text-[#1f5f33]',
  logistics: 'bg-[#fde0cc] text-[#8a3a00]',
  production: 'bg-[#f8d7e0] text-[#8f1d3f]',
};

const WARNING_ACTIONS = new Set([
  'login.failed',
  'login.locked',
  'login.inactive_account',
  'delivery.failed',
  'batch.waste_recorded',
]);

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
    <li className="border-t border-[#e6e1df]">
      <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 px-4 md:px-5 py-3">
        <time
          dateTime={entry.created_at}
          className="w-12 shrink-0 pt-0.5 text-[13px] font-extrabold tabular-nums text-[#5f5a58]"
        >
          {formatTime(entry.created_at)}
        </time>

        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${CATEGORY_TONES[entry.category]}`}>
              {entry.category_label}
            </span>
            <span
              className={`text-[15px] font-extrabold ${WARNING_ACTIONS.has(entry.action) ? 'text-[#b91c1c]' : 'text-bakery-dark'}`}
            >
              {entry.action_label}
            </span>
            {entry.object_label &&
              (entry.object_type ? (
                <button
                  type="button"
                  onClick={() => onShowHistory(entry)}
                  title="Pokaż historię tego obiektu"
                  className="inline-flex items-center gap-1 text-[13px] font-bold text-[#4a4543] underline decoration-dotted underline-offset-2 hover:text-bakery-dark"
                >
                  <History className="w-3.5 h-3.5" aria-hidden />
                  {entry.object_label}
                </button>
              ) : (
                <span className="text-[13px] font-bold text-[#4a4543]">{entry.object_label}</span>
              ))}
          </div>
          <p className="m-0 text-sm font-semibold text-[#3d3937] break-words">{entry.description}</p>
          <p className="m-0 text-xs font-bold text-[#5f5a58]">{entry.actor_name || 'System'}</p>
        </div>

        {hasDetails && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="self-start inline-flex items-center gap-1.5 min-h-9 px-3 rounded-[10px] border border-bakery-btnBorder bg-white text-[13px] font-extrabold hover:border-[#8f8a88]"
          >
            {entry.changes.length > 0 ? `Zmiany (${entry.changes.length})` : 'Szczegóły'}
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        )}
      </div>

      {open && (
        <div className="mx-4 md:mx-5 mb-4 sm:ml-[84px] p-3.5 flex flex-col gap-2 rounded-xl border border-[#e2dcda] bg-white">
          {entry.changes.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-[13px]">
                <thead>
                  <tr className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#5f5a58]">
                    <th scope="col" className="py-1 pr-3">
                      Pole
                    </th>
                    <th scope="col" className="py-1 pr-3">
                      Było
                    </th>
                    <th scope="col" className="py-1">
                      Jest
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entry.changes.map((change) => (
                    <tr key={change.field} className="border-t border-[#eee9e7] align-top">
                      <th scope="row" className="py-2 pr-3 font-extrabold">
                        {change.label}
                      </th>
                      <td className="py-2 pr-3 font-semibold text-[#5f5a58]">{formatAuditValue(change.old)}</td>
                      <td className="py-2 font-bold">{formatAuditValue(change.new)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {entry.ip_address && (
            <p className="m-0 text-xs font-semibold text-[#5f5a58]">
              Adres IP: <span className="font-mono">{entry.ip_address}</span>
            </p>
          )}
        </div>
      )}
    </li>
  );
}