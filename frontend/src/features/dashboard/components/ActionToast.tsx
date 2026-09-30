import { useEffect } from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';

export interface ActionToastData {
  text: string;
  canRefresh: boolean;
}

export function ActionToast({
  toast,
  onClose,
  onRefresh,
}: {
  toast: ActionToastData | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  useEffect(() => {
    if (!toast || toast.canRefresh) return;
    const timer = setTimeout(onClose, 8000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-4 z-[2000] sm:inset-x-auto sm:right-6 sm:w-96 bg-white border border-red-300 rounded-xl shadow-lg p-3 flex items-start gap-2.5 text-bakery-dark"
    >
      <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="m-0 text-sm font-semibold">{toast.text}</p>
        {toast.canRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="mt-2 inline-flex items-center gap-1.5 min-h-[40px] sm:min-h-0 px-3 py-1.5 text-xs font-bold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded-lg shadow-xs transition active:scale-[0.98]"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Odśwież dane
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Zamknij"
        className="p-1 text-gray-400 hover:text-bakery-dark"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}