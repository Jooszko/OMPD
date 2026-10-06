import { RefreshCw, WifiOff } from 'lucide-react';
import { formatTime } from '../lib/dateFormat';

export function OfflineBanner({
  isOnline,
  savedAt,
  pendingCount,
  syncing,
  onSyncNow,
}: {
  isOnline: boolean;
  savedAt: Date | null;
  pendingCount: number;
  syncing: boolean;
  onSyncNow: () => void;
}) {
  return (
    <div
      role="status"
      className="flex items-start justify-between gap-2 bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700"
    >
      <span className="flex items-start gap-2">
        <WifiOff className="w-4 h-4 shrink-0 mt-px" />
        <span>
          {isOnline ? 'Nie udało się połączyć z serwerem.' : 'Brak połączenia z internetem.'}
          {savedAt && ` Widzisz dane z godz. ${formatTime(savedAt)}.`}
          {pendingCount > 0 &&
            ` Niewysłane akcje: ${pendingCount} – wyślemy je automatycznie po odzyskaniu połączenia.`}
          {pendingCount === 0 && ' Odświeżymy dane automatycznie po odzyskaniu połączenia.'}
        </span>
      </span>
      {isOnline && pendingCount > 0 && (
        <button
          type="button"
          onClick={onSyncNow}
          disabled={syncing}
          className="shrink-0 inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-0 px-2.5 py-1 font-bold bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Wysyłanie...' : 'Wyślij teraz'}
        </button>
      )}
    </div>
  );
}
