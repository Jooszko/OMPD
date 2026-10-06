import { AlertTriangle, X } from 'lucide-react';
import type { FailedAction } from '../../../services/actionQueue';
import { formatTime } from '../lib/dateFormat';

export function FailedActionsPanel({
  actions,
  onDismiss,
  onDismissAll,
}: {
  actions: FailedAction[];
  onDismiss: (actionId: string) => void;
  onDismissAll: () => void;
}) {
  if (actions.length === 0) return null;

  return (
    <section
      aria-label="Akcje, których nie udało się wysłać"
      className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex flex-col gap-2 text-xs text-rose-900"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 flex items-center gap-1.5 font-bold">
          <AlertTriangle className="w-4 h-4 text-rose-600" /> Nie udało się wysłać ({actions.length})
        </p>
        <button
          type="button"
          onClick={onDismissAll}
          className="min-h-[44px] sm:min-h-0 px-1 font-bold text-rose-700 hover:underline"
        >
          Wyczyść listę
        </button>
      </div>
      <p className="m-0 text-rose-800">
        Te akcje zostały wykonane bez zasięgu, ale serwer ich nie przyjął – zwykle dlatego, że biuro w międzyczasie
        zmieniło zamówienie. Sprawdź aktualny stan przystanku.
      </p>
      <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
        {actions.map((action) => (
          <li
            key={action.id}
            className="flex items-start justify-between gap-2 bg-white border border-rose-200 rounded px-2 py-1.5"
          >
            <div className="min-w-0">
              <p className="m-0 font-semibold break-words">
                {action.label} <span className="text-gray-500 font-normal">· {formatTime(action.occurredAt)}</span>
              </p>
              <p className="m-0 text-rose-700">{action.error}</p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(action.id)}
              aria-label={`Usuń z listy: ${action.label}`}
              className="shrink-0 p-1 text-gray-400 hover:text-bakery-dark"
            >
              <X className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}