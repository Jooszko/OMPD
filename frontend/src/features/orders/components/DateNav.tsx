import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { CalendarPicker } from '../../../components/ui/CalendarPicker';
import { formatDayHeading, relativeDayLabel, shiftIsoDate } from '../lib/orders';

const STEP_BUTTON =
  'size-11 shrink-0 inline-flex items-center justify-center rounded-xl border border-bakery-btnBorder bg-bakery-card text-bakery-dark hover:border-[#8f8a88]';
const CHIP = 'min-h-10 px-3.5 rounded-full border text-[13px] font-extrabold whitespace-nowrap';
const CALENDAR_BUTTON =
  'inline-flex items-center gap-2 min-h-10 px-3.5 rounded-full border border-bakery-btnBorder bg-bakery-card text-[13px] font-extrabold hover:border-[#8f8a88] focus-visible:outline-2 focus-visible:outline-bakery-accent';

export function DateNav({
  date,
  today,
  max,
  onChange,
}: {
  date: string;
  today: string;
  max?: string;
  onChange: (date: string) => void;
}) {
  const relative = relativeDayLabel(date, today);
  const tomorrow = shiftIsoDate(today, 1);
  const quickDays = [
    { value: today, label: 'Dziś' },
    { value: tomorrow, label: 'Jutro' },
  ].filter((option) => !max || option.value <= max);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="w-full sm:w-auto flex items-center gap-2">
        <button
          type="button"
          aria-label="Poprzedni dzień"
          onClick={() => onChange(shiftIsoDate(date, -1))}
          className={STEP_BUTTON}
        >
          <ChevronLeft aria-hidden className="w-5 h-5" />
        </button>
        <div className="flex-1 sm:flex-none sm:min-w-[200px] flex flex-col items-center text-center leading-tight">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]">
            {relative ?? 'Wybrany dzień'}
          </span>
          <span className="font-display text-base sm:text-xl font-extrabold text-balance first-letter:uppercase">
            {formatDayHeading(date)}
          </span>
        </div>
        <button
          type="button"
          aria-label="Następny dzień"
          onClick={() => onChange(shiftIsoDate(date, 1))}
          disabled={!!max && date >= max}
          className={`${STEP_BUTTON} disabled:opacity-40`}
        >
          <ChevronRight aria-hidden className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        {quickDays.map((option) => (
          <button
            key={option.label}
            type="button"
            aria-pressed={date === option.value}
            onClick={() => onChange(option.value)}
            className={`${CHIP} ${
              date === option.value
                ? 'bg-bakery-dark border-bakery-dark text-white'
                : 'bg-bakery-card border-bakery-btnBorder text-bakery-dark hover:border-[#8f8a88]'
            }`}
          >
            {option.label}
          </button>
        ))}
        <CalendarPicker
          value={date}
          max={max}
          onChange={onChange}
          label="Wybierz dzień"
          triggerClassName={CALENDAR_BUTTON}
        >
          <CalendarDays aria-hidden className="w-4 h-4" />
          Kalendarz
        </CalendarPicker>
      </div>
    </div>
  );
}