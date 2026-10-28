import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { CalendarPicker } from '../../../components/ui/CalendarPicker';
import { shiftIsoDate } from '../lib/dateFormat';

const NAV_BUTTON =
  'inline-flex items-center justify-center w-11 h-11 sm:w-8 sm:h-8 bg-white border border-bakery-btnBorder text-bakery-dark rounded-lg shadow-xs transition hover:bg-bakery-inactive active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed';

export function DayNavigator({
  date,
  today,
  onChangeDate,
}: {
  date: string;
  today: string;
  onChangeDate: (date: string | null) => void;
}) {
  const isHistory = date !== today;
  const goToDate = (target: string) => onChangeDate(target >= today ? null : target);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => goToDate(shiftIsoDate(date, -1))}
        aria-label="Poprzedni dzień"
        className={NAV_BUTTON}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <CalendarPicker
        value={date}
        max={today}
        onChange={goToDate}
        label="Wybierz dzień"
        triggerClassName="inline-flex h-11 sm:h-8 items-center gap-2 px-3 sm:px-2 text-sm sm:text-xs font-semibold bg-white border border-bakery-btnBorder text-bakery-dark rounded-lg shadow-xs transition hover:bg-bakery-inactive outline-none focus-visible:border-bakery-accent focus-visible:ring-2 focus-visible:ring-bakery-accent/30"
      >
        <CalendarDays aria-hidden className="size-4 shrink-0" />
        {date.split('-').reverse().join('.')}
      </CalendarPicker>
      <button
        type="button"
        onClick={() => goToDate(shiftIsoDate(date, 1))}
        disabled={!isHistory}
        aria-label="Następny dzień"
        className={NAV_BUTTON}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      {isHistory && (
        <button
          type="button"
          onClick={() => onChangeDate(null)}
          className="min-h-[44px] sm:min-h-0 px-3 py-1 text-xs font-bold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded-lg shadow-xs transition active:scale-[0.98]"
        >
          Dziś
        </button>
      )}
    </div>
  );
}

export function HistoryNotice() {
  return (
    <p className="m-0 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2 text-xs font-semibold text-sky-800">
      Podgląd historii, tylko do odczytu. Statusów z innych dni nie można zmieniać.
    </p>
  );
}