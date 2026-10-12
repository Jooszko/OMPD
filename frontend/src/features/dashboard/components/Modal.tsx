import { type ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

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

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const initial =
      (initialFocusSelector && dialog?.querySelector<HTMLElement>(initialFocusSelector)) ||
      dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    initial?.focus();
    return () => previouslyFocused?.focus();
  }, [initialFocusSelector]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!closeDisabled) onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const focusInside = dialogRef.current.contains(active);

      if (e.shiftKey && (active === first || !focusInside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !focusInside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, closeDisabled]);

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