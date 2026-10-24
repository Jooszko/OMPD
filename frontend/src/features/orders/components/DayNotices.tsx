import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarOff, Lock, Repeat, TriangleAlert } from 'lucide-react';
import { createOrdersFromStanding, type OrderDay } from '../../../services/api';
import { apiErrorMessage } from '../../users/lib/staff';
import { plural } from '../lib/orders';

const NOTICE = 'flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-[14px] text-sm font-bold';
const ACTION = 'min-h-10 px-3.5 rounded-[10px] bg-bakery-dark text-white text-[13px] font-extrabold disabled:opacity-60';

export function DayNotices({ day, onChanged }: { day: OrderDay; onChanged: () => void }) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const due = day.standing_due;
  const changes = day.plan?.changes ?? [];

  const createFromStanding = async () => {
    setCreating(true);
    setError(null);
    try {
      await createOrdersFromStanding(day.date);
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, 'Nie udało się utworzyć zamówień ze stałych.'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      {day.is_past && (
        <p className={`${NOTICE} m-0 bg-[#e6e1df] text-[#3d3937]`}>
          <span className="flex items-center gap-2.5">
            <Lock aria-hidden className="w-5 h-5 shrink-0" />
            Miniony dzień – zamówienia są tylko do podglądu.
          </span>
        </p>
      )}

      {day.is_holiday && (
        <p className={`${NOTICE} m-0 bg-[#f3eefb] text-[#4f3593]`}>
          <span className="flex items-center gap-2.5">
            <CalendarOff aria-hidden className="w-5 h-5 shrink-0" />
            Święto ustawowe – zamówienia stałe nie tworzą się automatycznie.
          </span>
        </p>
      )}

      {due && due.clients > 0 && (
        <div className={`${NOTICE} bg-[#fbe5bd] text-[#5c3300]`}>
          <span className="flex items-center gap-2.5">
            <Repeat aria-hidden className="w-5 h-5 shrink-0" />
            {due.clients} {plural(due.clients, 'klient', 'klientów', 'klientów')} ze stałym zamówieniem nie ma jeszcze
            zamówienia na ten dzień.
          </span>
          <button type="button" onClick={createFromStanding} disabled={creating} className={ACTION}>
            {creating ? 'Tworzenie…' : `Utwórz (${due.items} ${plural(due.items, 'pozycja', 'pozycje', 'pozycji')})`}
          </button>
          {error && <span role="alert" className="basis-full text-[13px] text-[#991b1b]">{error}</span>}
        </div>
      )}

      {changes.length > 0 && (
        <div className={`${NOTICE} bg-[#fbdcdc] text-[#7f1d1d]`}>
          <span className="flex items-start gap-2.5">
            <TriangleAlert aria-hidden className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="flex flex-col gap-1">
              Plan produkcji na ten dzień nie uwzględnia ostatnich zmian w zamówieniach:
              <span className="font-semibold">
                {changes
                  .map((change) => `${change.product_name} ${change.planned_qty} → ${change.current_qty}`)
                  .join(' · ')}
              </span>
            </span>
          </span>
          <Link to="/production" className={`${ACTION} inline-flex items-center`}>
            Przelicz plan
          </Link>
        </div>
      )}
    </>
  );
}