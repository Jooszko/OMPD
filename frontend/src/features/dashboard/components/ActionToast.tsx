import { useEffect } from 'react';
import { AlertCircle, CircleCheck, RefreshCw, Undo2, X } from 'lucide-react';

export interface ActionToastData {
  text: string;
  variant?: 'error' | 'success';
  canRefresh?: boolean;
  onUndo?: () => void;
}

const ERROR_TIMEOUT_MS = 8000;
const UNDO_TIMEOUT_MS = 10000;

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
    const timer = setTimeout(onClose, toast.onUndo ? UNDO_TIMEOUT_MS : ERROR_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const isSuccess = toast.variant === 'success';

  return (
    <div
      role={isSuccess ? 'status' : 'alert'}
      className={`fixed inset-x-4 bottom-4 z-[2000] sm:inset-x-auto sm:right-6 sm:w-96 bg-white border rounded-xl shadow-lg p-3 flex items-start gap-2.5 text-bakery-dark ${
        isSuccess ? 'border-emerald-300' : 'border-red-300'
      }`}
    >
      {isSuccess ? (
        <CircleCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
      ) : (
        <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <p className="m-0 text-sm font-semibold whitespace-pre-line">{toast.text}</p>
        {toast.canRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="mt-2 inline-flex items-center gap-1.5 min-h-[40px] sm:min-h-0 px-3 py-1.5 text-xs font-bold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded-lg shadow-xs transition active:scale-[0.98]"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Odśwież dane
          </button>
        )}
        {toast.onUndo && (
          <button
            type="button"
            onClick={toast.onUndo}
            className="mt-2 inline-flex items-center gap-1.5 min-h-[40px] sm:min-h-0 px-3 py-1.5 text-xs font-bold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded-lg shadow-xs transition active:scale-[0.98]"
          >
            <Undo2 className="w-3.5 h-3.5" /> Cofnij
          </button>
        )}
      </div>
      <button type="button" onClick={onClose} aria-label="Zamknij" className="p-1 text-gray-400 hover:text-bakery-dark">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}