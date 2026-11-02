import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { PlanCalendarDay } from '../../../../services/api';
import { CalendarPicker } from '../../../../components/ui/CalendarPicker';
import { CALENDAR_COLORS, CALENDAR_LABELS, dayOfMonth, formatPieces, monthShort, weekdayShort } from '../../lib/planning';

const ARROW =
  'shrink-0 grid place-items-center size-10 rounded-xl border border-bakery-btnBorder bg-white text-bakery-dark cursor-pointer transition hover:border-bakery-dark';

export function WeekStrip({
  days,
  selected,
  today,
  loading,
  onSelect,
  onShift,
  onJump,
}: {
  days: PlanCalendarDay[];
  selected: string;
  today: string;
  loading: boolean;
  onSelect: (date: string) => void;
  onShift: (days: number) => void;
  onJump: (date: string) => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[aria-pressed="true"]')?.parentElement;
    if (!list || !active) return;
    list.scrollLeft = active.offsetLeft - (list.clientWidth - active.clientWidth) / 2;
  }, [selected, days]);

  return (
    <section
      aria-label="Dni dostawy"
      className="flex flex-col gap-3 p-4 sm:px-6 rounded-[18px] bg-bakery-card border border-bakery-btnBorder"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]">Dzień dostawy</span>
          <span className="text-xs font-semibold text-[#5f5a58]">Zmiana piecze dzień wcześniej.</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {(Object.keys(CALENDAR_LABELS) as (keyof typeof CALENDAR_LABELS)[]).map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3d3937]">
              <span aria-hidden className="size-2 rounded-full" style={{ background: CALENDAR_COLORS[status] }} />
              {CALENDAR_LABELS[status]}
            </span>
          ))}
          <CalendarPicker
            value={selected}
            onChange={onJump}
            label="Wybierz datę dostawy"
            align="end"
            triggerClassName="inline-flex items-center gap-2 h-9 px-3 rounded-full border border-bakery-btnBorder bg-white text-[13px] font-extrabold text-bakery-dark cursor-pointer outline-none hover:border-bakery-dark focus-visible:border-bakery-accent"
          >
            <CalendarDays aria-hidden className="size-4" />
            Inna data
          </CalendarPicker>
        </div>
      </div>

      <div className={`flex items-stretch gap-2 transition-opacity ${loading ? 'opacity-50' : ''}`}>
        <button type="button" aria-label="Poprzedni tydzień" onClick={() => onShift(-7)} className={`${ARROW} self-center`}>
          <ChevronLeft aria-hidden className="size-4" />
        </button>
        <ol ref={listRef} className="relative flex-1 min-w-0 m-0 p-0 list-none grid grid-cols-[repeat(7,minmax(56px,1fr))] gap-1.5 sm:gap-2 overflow-x-auto">
          {days.map((day) => {
            const active = day.delivery_date === selected;
            const isToday = day.delivery_date === today;
            return (
              <li key={day.delivery_date}>
                <button
                  type="button"
                  aria-pressed={active}
                  aria-label={`${weekdayShort(day.delivery_date)} ${dayOfMonth(day.delivery_date)} ${monthShort(day.delivery_date)}: ${CALENDAR_LABELS[day.status]}, ${formatPieces(day.pieces)}`}
                  onClick={() => onSelect(day.delivery_date)}
                  className={`w-full h-full flex flex-col items-center gap-1 px-1 py-2.5 rounded-[14px] border cursor-pointer transition ${
                    active
                      ? 'bg-bakery-dark border-bakery-dark text-white'
                      : 'bg-white border-[#e6e1df] text-bakery-dark hover:border-bakery-dark'
                  }`}
                >
                  <span className={`text-[11px] font-extrabold uppercase tracking-[0.06em] ${active ? 'text-bakery-accent' : 'text-[#5f5a58]'}`}>
                    {isToday ? 'dziś' : weekdayShort(day.delivery_date)}
                  </span>
                  <span className="font-display text-[22px] sm:text-[26px] leading-none font-extrabold tabular-nums">
                    {dayOfMonth(day.delivery_date)}
                  </span>
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ background: CALENDAR_COLORS[day.status], boxShadow: active ? '0 0 0 2px #1a1a1a' : undefined }}
                  />
                  <span className={`hidden sm:block text-[11px] font-bold tabular-nums ${active ? 'text-[#d9d2cf]' : 'text-[#5f5a58]'}`}>
                    {day.pieces > 0 ? formatPieces(day.pieces) : 'brak zamówień'}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <button type="button" aria-label="Następny tydzień" onClick={() => onShift(7)} className={`${ARROW} self-center`}>
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>
    </section>
  );
}
