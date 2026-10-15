import type { ClosingDay } from '../../../services/api';
import { formatDayLabel, formatTime } from '../../dashboard/lib/dateFormat';
import { formatMoney } from '../lib/money';

const TH = 'py-2 px-2.5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#5f5a58]';
const ACTION =
  'h-9 px-3 rounded-[10px] text-[13px] font-extrabold whitespace-nowrap disabled:opacity-50';

export function ClosingsTable({
  days,
  today,
  busyDate,
  onClose,
  onReopen,
}: {
  days: ClosingDay[];
  today: string;
  busyDate: string | null;
  onClose: (date: string) => void;
  onReopen: (date: string) => void;
}) {
  return (
    <section className="min-w-0 bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm p-5 sm:p-6 flex flex-col gap-3.5">
      <div className="flex flex-col gap-0.5">
        <h2 className="m-0 text-lg font-extrabold">Zamknięcia dni</h2>
        <p className="m-0 text-[13px] text-[#5f5a58]">
          Zamknięty dzień zapisuje kwoty na stałe. Jeśli coś zmieni się później, zobaczysz rozbieżność i zdecydujesz, czy
          otworzyć dzień ponownie.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-left tabular-nums">
          <thead>
            <tr>
              <th scope="col" className={TH}>Dzień</th>
              <th scope="col" className={`${TH} text-right`}>Przychód</th>
              <th scope="col" className={`${TH} text-right`}>Surowce</th>
              <th scope="col" className={`${TH} text-right`}>Koszty</th>
              <th scope="col" className={`${TH} text-right`}>Wynik</th>
              <th scope="col" className={TH}>Status</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const profit = Math.round(Number(day.net_profit));
              const isToday = day.date === today;
              const busy = busyDate === day.date;
              return (
                <tr key={day.date} className={`border-t border-bakery-rowBg ${isToday ? 'bg-[#fff7e8]' : ''}`}>
                  <th scope="row" className="py-3 px-2.5 text-sm font-extrabold whitespace-nowrap first-letter:uppercase">
                    {isToday ? `Dziś, ${formatDayLabel(day.date)}` : formatDayLabel(day.date)}
                  </th>
                  <td className="py-3 px-2.5 text-right text-sm">{formatMoney(day.revenue)}</td>
                  <td className="py-3 px-2.5 text-right text-sm">{formatMoney(-Number(day.cogs))}</td>
                  <td className="py-3 px-2.5 text-right text-sm">{formatMoney(-Number(day.operating_expenses))}</td>
                  <td
                    className={`py-3 px-2.5 text-right text-[15px] font-extrabold ${profit < 0 ? 'text-[#b91c1c]' : 'text-bakery-dark'}`}
                  >
                    {formatMoney(day.net_profit, { sign: true })}
                  </td>
                  <td className="py-2 px-2.5">
                    {day.closed ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#4a4543]">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <rect x="5" y="11" width="14" height="10" rx="2" />
                            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                          </svg>
                          Zamknięty · {day.closed.closed_by ?? 'System'}, {formatTime(day.closed.closed_at)}
                        </span>
                        {day.drift && (
                          <span
                            title={`Przy zamknięciu: ${formatMoney(day.closed.net_profit, { sign: true })}`}
                            className="px-2 py-0.5 rounded-full bg-[#fbdcdc] text-[11px] font-extrabold text-[#991b1b]"
                          >
                            zmiana po zamknięciu {formatMoney(day.drift, { sign: true })}
                          </span>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onReopen(day.date)}
                          className={`${ACTION} border border-bakery-btnBorder bg-white text-bakery-dark`}
                        >
                          Otwórz ponownie
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-[#5f5a58]">Otwarty · liczony na bieżąco</span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onClose(day.date)}
                          className={`${ACTION} border border-bakery-accent bg-bakery-accent text-bakery-dark`}
                        >
                          Zamknij dzień
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}