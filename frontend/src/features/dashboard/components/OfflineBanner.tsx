import { WifiOff } from 'lucide-react';
import { formatTime } from '../lib/dateFormat';

export function OfflineBanner({ isOnline, savedAt }: { isOnline: boolean; savedAt: Date | null }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700"
    >
      <WifiOff className="w-4 h-4 shrink-0 mt-px" />
      <span>
        {isOnline ? 'Nie udało się połączyć z serwerem.' : 'Brak połączenia z internetem.'}
        {savedAt && ` Widzisz dane z godz. ${formatTime(savedAt)}.`} Odświeżymy je automatycznie po odzyskaniu
        połączenia.
      </span>
    </div>
  );
}