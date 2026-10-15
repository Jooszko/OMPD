import { type ReactNode, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useDialogFocus } from './useDialogFocus';

export function Modal({
  title,
  subtitle,
  icon,
  initialFocusSelector,
  closeDisabled = false,
  size = 'md',
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  initialFocusSelector?: string;
  closeDisabled?: boolean;
  size?: 'md' | 'xl';
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useDialogFocus(dialogRef, onClose, { initialFocusSelector, closeDisabled });

  return createPortal(
    <div
      className="fixed inset-0 z-[1900] bg-black/40 flex items-end sm:items-center justify-center"
      onClick={() => !closeDisabled && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${size === 'xl' ? 'sm:max-w-3xl' : 'sm:max-w-md'} bg-white rounded-t-2xl sm:rounded-xl shadow-xl p-4 flex flex-col gap-3 text-bakery-dark max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 id={titleId} className="m-0 text-base font-bold flex items-center gap-2">
              {icon} {title}
            </h2>
            {subtitle && <p className="m-0 mt-0.5 text-xs text-gray-500 font-medium">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Zamknij"
            className="p-1 text-gray-400 hover:text-bakery-dark"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
