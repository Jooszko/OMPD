import { useRef } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDayHeading, relativeDayLabel, shiftIsoDate } from '../lib/orders';

const STEP_BUTTON =
  'size-11 shrink-0 inline-flex items-center justify-center rounded-xl border border-bakery-btnBorder bg-bakery-card text-bakery-dark hover:border-[#8f8a88]';
const CHIP = 'min-h-10 px-3.5 rounded-full border text-[13px] font-extrabold whitespace-nowrap';

export function DateNav({ date, today, onChange }: { date: string; today: string; onChange: (date: string) => void }) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const relative = relativeDayLabel(date, today);
  const tomorrow = shiftIsoDate(today, 1);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Poprzedni dzień" onClick={() => onChange(shiftIsoDate(date, -1))} className={STEP_BUTTON}>
          <ChevronLeft aria-hidden className="w-5 h-5" />
        </button>
        <div className="min-w-[200px] flex flex-col items-center leading-tight">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]">{relative ?? 'Wybrany dzień'}</span>
          <span className="font-display text-xl font-extrabold first-letter:uppercase">{formatDayHeading(date)}</span>
        </div>
        <button type="button" aria-label="Następny dzień" onClick={() => onChange(shiftIsoDate(date, 1))} className={STEP_BUTTON}>
          <ChevronRight aria-hidden className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        {[
          { value: today, label: 'Dziś' },
          { value: tomorrow, label: 'Jutro' },
        ].map((option) => (
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
        <span className="relative">
          <button
            type="button"
            onClick={() => {
              try {
                pickerRef.current?.showPicker();
              } catch {
                pickerRef.current?.focus();
              }
            }}
            className="inline-flex items-center gap-2 min-h-10 px-3.5 rounded-full border border-bakery-btnBorder bg-bakery-card text-[13px] font-extrabold hover:border-[#8f8a88]"
          >
            <CalendarDays aria-hidden className="w-4 h-4" />
            Kalendarz
          </button>
          <input
            ref={pickerRef}
            type="date"
            tabIndex={-1}
            aria-label="Wybierz dzień"
            value={date}
            onChange={(event) => event.target.value && onChange(event.target.value)}
            className="absolute inset-0 opacity-0 pointer-events-none"
          />
        </span>
      </div>
    </div>
  );
}