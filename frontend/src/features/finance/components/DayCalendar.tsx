import type { Statement } from '../../../services/api';
import { formatMoney } from '../lib/money';
import { calendarCells, compactMoney, DAY_SCALE, dayTone } from '../lib/reports';

const WEEKDAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];

export function DayCalendar({ statement }: { statement: Statement }) {
  const values = statement.days.map((day) => Number(day.net_profit));
  const maxGain = Math.max(0, ...values);
  const maxLoss = Math.abs(Math.min(0, ...values));
  const cells = calendarCells(statement.period.start, statement.days);
  const known = statement.days.map((day) => ({ date: day.date, value: Number(day.net_profit) }));
  const best = known.reduce<(typeof known)[number] | null>((top, day) => (!top || day.value > top.value ? day : top), null);
  const worst = known.reduce<(typeof known)[number] | null>((low, day) => (!low || day.value < low.value ? day : low), null);
  const dayName = (date: string) => `${Number(date.slice(8))}.${date.slice(5, 7)}`;

  return (
    <section className="flex-[1_1_340px] min-w-0 bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm p-5 sm:p-6 flex flex-col gap-3.5">
      <div className="flex flex-col gap-0.5">
        <h2 className="m-0 text-lg font-extrabold">Wynik dnia – {statement.period.label}</h2>
        <p className="m-0 text-[13px] text-[#5f5a58]">Niebieskie dni na plusie, czerwone na minusie.</p>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} aria-hidden className="pb-0.5 text-center text-[11px] font-extrabold text-[#5f5a58]">
            {weekday}
          </span>
        ))}
        {cells.map((cell, index) => {
          if (!cell.date) return <span key={`blank-${index}`} aria-hidden />;
          const tone = dayTone(cell.value, maxGain, maxLoss);
          return (
            <span
              key={cell.date}
              role="img"
              aria-label={cell.value === null ? `${cell.day}: brak danych` : `${cell.day}: ${formatMoney(cell.value)}`}
              className={`aspect-square min-h-9 rounded-lg flex flex-col items-center justify-center tabular-nums ${
                cell.value === null ? 'border border-dashed border-[#d9d4d2]' : ''
              }`}
              style={tone}
            >
              <span className="text-xs font-extrabold">{cell.day}</span>
              {cell.value !== null && <span className="hidden sm:block text-[10px] font-bold">{compactMoney(cell.value)}</span>}
            </span>
          );
        })}
      </div>

      <div aria-hidden className="flex items-center gap-1.5 text-[11px] font-bold text-[#5f5a58]">
        strata
        {DAY_SCALE.map((color) => (
          <span key={color} className="flex-1 h-2.5 rounded-[3px]" style={{ background: color }} />
        ))}
        zysk
      </div>

      {known.length > 0 && best && worst && (
        <ul className="m-0 p-0 list-none flex flex-col gap-2 text-[13px] tabular-nums">
          <li className="flex justify-between gap-2">
            <span className="font-semibold text-[#4a4543]">Dni na plusie</span>
            <strong>
              {known.filter((day) => Math.round(day.value) > 0).length} z {known.length}
            </strong>
          </li>
          <li className="flex justify-between gap-2">
            <span className="font-semibold text-[#4a4543]">Najlepszy dzień</span>
            <strong>
              {dayName(best.date)} · {formatMoney(best.value)}
            </strong>
          </li>
          <li className="flex justify-between gap-2">
            <span className="font-semibold text-[#4a4543]">Najgorszy dzień</span>
            <strong>
              {dayName(worst.date)} · {formatMoney(worst.value)}
            </strong>
          </li>
        </ul>
      )}
    </section>
  );
}