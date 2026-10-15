import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAuditEntries, type AuditEntry } from '../../../services/api';
import { formatAuditValue } from '../../dashboard/lib/auditFormat';
import { apiErrorMessage, formatDateTime, historyTone, type HistoryTone } from '../lib/staff';

const HISTORY_SIZE = 8;

const DOT_TONES: Record<HistoryTone, string> = {
  success: 'bg-[#1f7a3a] ring-[#cdebd5]',
  danger: 'bg-[#b91c1c] ring-[#f8cccc]',
  change: 'bg-[#2a78d6] ring-[#dfe8f6]',
  password: 'bg-[#c98a0c] ring-[#fbe5bd]',
  neutral: 'bg-[#8a8482] ring-[#ebe7e7]',
};

interface LoadedHistory {
  key: string;
  entries: AuditEntry[];
  total: number;
  error: string | null;
}

export function AccountHistory({ userId, fullName, version }: { userId: number; fullName: string; version: number }) {
  const [loaded, setLoaded] = useState<LoadedHistory | null>(null);
  const key = `${userId}|${version}`;

  useEffect(() => {
    let cancelled = false;
    fetchAuditEntries({ object_type: 'user', object_id: String(userId), page_size: String(HISTORY_SIZE) })
      .then((page) => {
        if (!cancelled) setLoaded({ key, entries: page.results, total: page.count, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoaded({ key, entries: [], total: 0, error: apiErrorMessage(err, 'Nie udało się pobrać historii.') });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, key]);

  const current = loaded?.key === key ? loaded : null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="m-0 text-xs font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]">Historia konta</h3>
        <Link
          to="/audit-log"
          state={{ objectFilter: { type: 'user', id: String(userId), label: fullName } }}
          className="text-[13px] font-extrabold text-bakery-dark"
        >
          Cały dziennik →
        </Link>
      </div>

      {!current && <div aria-label="Wczytywanie historii" className="h-24 rounded-xl bg-bakery-inactive animate-pulse" />}
      {current?.error && <p className="m-0 text-sm font-semibold text-rose-700">{current.error}</p>}
      {current && !current.error && current.entries.length === 0 && (
        <p className="m-0 text-sm font-semibold italic text-[#5f5a58]">Brak wpisów w dzienniku dla tego konta.</p>
      )}

      {current && current.entries.length > 0 && (
        <ol className="m-0 p-0 list-none flex flex-col gap-4">
          {current.entries.map((entry) => (
            <li key={entry.entry_id} className="grid grid-cols-[20px_1fr] gap-3">
              <span aria-hidden className={`mt-1 w-3 h-3 rounded-full ring-4 ${DOT_TONES[historyTone(entry.action)]}`} />
              <span className="min-w-0 flex flex-col gap-1">
                <span className="text-sm font-extrabold">{entry.action_label}</span>
                {entry.changes.map((change) => (
                  <span key={change.field} className="flex flex-wrap items-center gap-1.5 text-[13px] font-bold">
                    <span className="text-[#5f5a58]">{change.label}:</span>
                    <span className="px-2 rounded-md bg-[#f3efed] text-[#5f5a58] line-through">{formatAuditValue(change.old)}</span>
                    <span aria-hidden>→</span>
                    <span className="sr-only">zmieniono na</span>
                    <span className="px-2 rounded-md bg-[#dfe8f6] text-[#1d4f91]">{formatAuditValue(change.new)}</span>
                  </span>
                ))}
                <span className="text-xs font-semibold text-[#5f5a58]">
                  {formatDateTime(entry.created_at)}
                  {entry.actor !== userId && entry.actor_name && ` · ${entry.actor_name}`}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}

      {current && current.total > current.entries.length && (
        <p className="m-0 text-xs font-semibold text-[#5f5a58]">
          Pokazano {current.entries.length} najnowszych z {current.total} wpisów.
        </p>
      )}
    </section>
  );
}