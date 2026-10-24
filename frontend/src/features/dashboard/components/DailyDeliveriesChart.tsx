import { type KeyboardEvent, useState } from 'react';
import type { DeliveryStatsDay } from '../../../services/api';
import { niceTicks } from '../lib/statsFormat';

const SERIES = [
  { key: 'delivered', label: 'Dostarczone', color: '#2e8b4e' },
  { key: 'failed', label: 'Nieudane', color: '#c62828' },
  { key: 'pending', label: 'W toku', color: '#e08a00' },
] as const;

const GRID_COLOR = '#e2dcda';
const MAX_X_LABELS = 7;

function shortDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

function longDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function DailyDeliveriesChart({ days }: { days: DeliveryStatsDay[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const totals = days.map((day) => day.delivered + day.failed + day.pending);
  const ticks = niceTicks(Math.max(0, ...totals));
  const top = ticks[ticks.length - 1];
  const labelEvery = Math.ceil(days.length / MAX_X_LABELS);
  const active = activeIndex !== null ? days[activeIndex] : null;
  const activeShare = activeIndex !== null ? ((activeIndex + 0.5) / days.length) * 100 : 0;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const direction = e.key === 'ArrowRight' ? 1 : -1;
    setActiveIndex((index) => {
      const from = index ?? (direction === 1 ? -1 : days.length);
      return Math.min(days.length - 1, Math.max(0, from + direction));
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="m-0 p-0 list-none flex flex-wrap gap-4 text-[13px] font-bold text-[#4a4543]">
        {SERIES.map((series) => (
          <li key={series.key} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-[3px]" style={{ background: series.color }} aria-hidden />
            {series.label}
          </li>
        ))}
      </ul>

      <div className="relative h-56 pl-9 pb-6">
        <div className="absolute left-9 right-0 top-0 bottom-6">
          {ticks.map((tick) => (
            <div
              key={tick}
              className="absolute left-0 right-0 border-t"
              style={{ bottom: `${(tick / top) * 100}%`, borderColor: GRID_COLOR }}
            >
              <span className="absolute -left-9 w-7 -translate-y-1/2 text-right text-[10px] text-[#5f5a58] tabular-nums">
                {tick}
              </span>
            </div>
          ))}
        </div>

        <div
          role="group"
          aria-label="Przystanki dziennie. Użyj strzałek w lewo i w prawo, aby przeglądać dni."
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onMouseLeave={() => setActiveIndex(null)}
          onBlur={() => setActiveIndex(null)}
          className="absolute left-9 right-0 top-0 bottom-6 flex items-end gap-[2px] rounded outline-none focus-visible:ring-2 focus-visible:ring-bakery-accent"
        >
          {days.map((day, index) => {
            const segments = SERIES.filter((series) => day[series.key] > 0);
            return (
              <div
                key={day.date}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex-1 h-full flex flex-col justify-end items-center rounded-t ${
                  activeIndex === index ? 'bg-black/5' : ''
                }`}
              >
                <div
                  className="w-full max-w-6 flex flex-col-reverse gap-[2px]"
                  style={{ height: `${(totals[index] / top) * 100}%` }}
                >
                  {segments.map((series, segmentIndex) => (
                    <div
                      key={series.key}
                      className={segmentIndex === segments.length - 1 ? 'rounded-t-[4px]' : ''}
                      style={{ background: series.color, flexGrow: day[series.key], flexBasis: 0 }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {active && (
          <div
            aria-live="polite"
            className="pointer-events-none absolute top-1 z-10 bg-white border border-bakery-btnBorder rounded-lg shadow-md px-3 py-2"
            style={{
              left: `calc(2.25rem + (100% - 2.25rem) * ${activeShare / 100})`,
              transform: `translateX(-${activeShare}%)`,
            }}
          >
            <p className="m-0 mb-1 text-[11px] font-semibold text-[#5f5a58] first-letter:uppercase">
              {longDate(active.date)}
            </p>
            {SERIES.map((series) => (
              <p key={series.key} className="m-0 flex items-center gap-2 text-xs">
                <span className="w-3 h-0.5 rounded" style={{ background: series.color }} aria-hidden />
                <strong className="text-bakery-dark tabular-nums">{active[series.key]}</strong>
                <span className="text-[#5f5a58]">{series.label}</span>
              </p>
            ))}
          </div>
        )}

        <div className="absolute left-9 right-0 bottom-0 h-5 flex gap-[2px]" aria-hidden>
          {days.map((day, index) => (
            <div key={day.date} className="flex-1 text-center text-[10px] text-[#5f5a58] whitespace-nowrap">
              {index % labelEvery === 0 ? shortDate(day.date) : ''}
            </div>
          ))}
        </div>
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer font-extrabold text-[#4a4543]">Pokaż dane w tabeli</summary>
        <div className="mt-2 max-h-64 overflow-y-auto">
          <table className="w-full text-left tabular-nums">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-[#5f5a58]">
                <th className="py-1 pr-3 font-bold">Dzień</th>
                {SERIES.map((series) => (
                  <th key={series.key} className="py-1 pr-3 font-bold text-right">
                    {series.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.date} className="border-t border-[#eee9e7]">
                  <td className="py-1 pr-3 first-letter:uppercase">{longDate(day.date)}</td>
                  {SERIES.map((series) => (
                    <td key={series.key} className="py-1 pr-3 text-right">
                      {day[series.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}