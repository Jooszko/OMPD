import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['pon', 'wt', 'śr', 'czw', 'pt', 'sob', 'nd'];

function firstOfMonth(iso: string): Date {
  const [year, month] = iso.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function getCalendarDates(month: Date): string[] {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  firstDay.setDate(firstDay.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstDay);
    date.setDate(firstDay.getDate() + index);
    return toIsoDate(date);
  });
}

function formatDay(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(year, month - 1, day));
}

export function CalendarPicker({
  value,
  min,
  max,
  onChange,
  label,
  children,
  triggerClassName,
}: {
  value: string;
  min?: string;
  max?: string;
  onChange: (date: string) => void;
  label: string;
  children: ReactNode;
  triggerClassName: string;
}) {
  const calendarId = useId();
  const calendarRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const calendarAnchor = value || max || toIsoDate(new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => firstOfMonth(calendarAnchor));
  const calendarDates = getCalendarDates(visibleMonth);
  const visibleMonthIso = toIsoDate(visibleMonth).slice(0, 7);
  const monthLabel = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' })
    .format(visibleMonth)
    .replace(/^./, (letter) => letter.toLocaleUpperCase('pl'));
  const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  const previousMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
  const minMonth = min ? firstOfMonth(min) : null;
  const maxMonth = max ? firstOfMonth(max) : null;
  const canShowPreviousMonth =
    !minMonth ||
    previousMonth.getFullYear() > minMonth.getFullYear() ||
    (previousMonth.getFullYear() === minMonth.getFullYear() && previousMonth.getMonth() >= minMonth.getMonth());
  const canShowNextMonth =
    !maxMonth ||
    nextMonth.getFullYear() < maxMonth.getFullYear() ||
    (nextMonth.getFullYear() === maxMonth.getFullYear() && nextMonth.getMonth() <= maxMonth.getMonth());

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !calendarRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [calendarAnchor, isOpen]);

  const selectDate = (date: string) => {
    onChange(date);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="relative" ref={calendarRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={calendarId}
        onClick={() => {
          if (!isOpen) setVisibleMonth(firstOfMonth(calendarAnchor));
          setIsOpen((open) => !open);
        }}
        className={triggerClassName}
      >
        {children}
      </button>
      {isOpen && (
        <div
          id={calendarId}
          role="dialog"
          aria-label={label}
          className="absolute left-0 z-30 mt-2 w-[280px] max-w-[calc(100vw-2rem)] rounded-xl border border-bakery-btnBorder bg-bakery-card p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-display text-sm font-extrabold">{monthLabel}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Poprzedni miesiąc"
                disabled={!canShowPreviousMonth}
                onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
                className="inline-flex size-8 items-center justify-center rounded-lg text-bakery-dark hover:bg-bakery-inactive disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronLeft aria-hidden className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Następny miesiąc"
                disabled={!canShowNextMonth}
                onClick={() => setVisibleMonth(nextMonth)}
                className="inline-flex size-8 items-center justify-center rounded-lg text-bakery-dark hover:bg-bakery-inactive disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronRight aria-hidden className="size-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday} className="py-1 text-[11px] font-bold capitalize text-[#5f5a58]">
                {weekday}
              </span>
            ))}
            {calendarDates.map((calendarDate) => {
              const isSelected = calendarDate === value;
              const isToday = calendarDate === toIsoDate(new Date());
              const isCurrentMonth = calendarDate.slice(0, 7) === visibleMonthIso;
              const isDisabled = (!!min && calendarDate < min) || (!!max && calendarDate > max);
              return (
                <button
                  key={calendarDate}
                  type="button"
                  aria-label={formatDay(calendarDate)}
                  aria-pressed={isSelected}
                  aria-current={isToday ? 'date' : undefined}
                  disabled={isDisabled}
                  onClick={() => selectDate(calendarDate)}
                  className={`mx-auto inline-flex size-8 items-center justify-center rounded-lg text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                    isSelected
                      ? 'bg-bakery-dark font-extrabold text-white'
                      : isToday
                        ? 'border border-bakery-accent font-bold text-bakery-dark'
                        : `text-bakery-dark hover:bg-bakery-inactive ${isCurrentMonth ? '' : 'opacity-45'}`
                  }`}
                >
                  {Number(calendarDate.slice(-2))}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex justify-end border-t border-bakery-btnBorder pt-2">
            <button
              type="button"
              disabled={
                (!!min && toIsoDate(new Date()) < min) ||
                (!!max && toIsoDate(new Date()) > max)
              }
              onClick={() => selectDate(toIsoDate(new Date()))}
              className="rounded-md px-2 py-1 text-xs font-bold text-bakery-dark hover:bg-bakery-inactive disabled:cursor-not-allowed disabled:opacity-40"
            >
              Dziś
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
