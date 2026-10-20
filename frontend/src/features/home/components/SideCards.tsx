import { Link } from 'react-router-dom';
import type { HomeChange, HomeShift } from '../../../services/api';
import { toIsoDate } from '../../dashboard/lib/dateFormat';
import { formatClock, formatShortDate, plural } from '../lib/home';

function dayName(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('pl-PL', { weekday: 'long' });
}

export function TomorrowCard({ shift, today }: { shift: HomeShift; today: string }) {
  const fromOrders = shift.pieces > 0;
  const pieces = fromOrders ? shift.pieces : shift.standing_pieces;
  const clients = fromOrders ? shift.clients : shift.standing_clients;
  const label = shift.delivery_date === today ? 'Dziś' : 'Jutro';
  const batches = shift.batches.length;

  return (
    <section aria-labelledby="tomorrow-title" className="flex flex-col gap-3 p-5 rounded-[18px] bg-bakery-accent text-bakery-dark">
      <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#3d2400]">
        {label} · {dayName(shift.delivery_date)} {formatShortDate(shift.delivery_date)}
      </span>
      <h2 id="tomorrow-title" className="m-0 font-display text-[26px] sm:text-[30px] leading-none font-extrabold">
        {pieces > 0 ? `${pieces} szt. dla ${clients} ${plural(clients, 'klienta', 'klientów', 'klientów')}` : 'Brak zamówień'}
      </h2>
      {pieces > 0 && !fromOrders && (
        <p className="m-0 text-[13px] font-bold text-[#3d2400]">Według zamówień stałych – dzienne jeszcze nie wpisane.</p>
      )}
      <p className="m-0 text-sm font-bold text-[#3d2400]">
        {shift.has_plan
          ? `Plan produkcji gotowy: ${batches} ${plural(batches, 'dzieża', 'dzieże', 'dzieży')}.`
          : 'Plan produkcji jeszcze nie powstał.'}
      </p>
      <Link
        to={shift.has_plan ? '/production/board' : '/production'}
        className="self-start inline-flex items-center min-h-11 px-[18px] rounded-xl bg-bakery-dark text-white text-sm font-extrabold no-underline"
      >
        {shift.has_plan ? 'Tablica produkcji' : 'Przygotuj plan'}
      </Link>
    </section>
  );
}

function changeTime(value: string, today: string): string {
  const date = new Date(value);
  if (toIsoDate(date) === today) return `dziś ${formatClock(value)}`;
  return `${date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })} ${formatClock(value)}`;
}

export function RecentChanges({ changes, today }: { changes: HomeChange[]; today: string }) {
  return (
    <section aria-labelledby="recent-title" className="flex-1 rounded-[18px] bg-bakery-card border border-bakery-btnBorder overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5">
        <h2 id="recent-title" className="m-0 text-base font-extrabold">Ostatnio w systemie</h2>
        <Link to="/audit-log" className="shrink-0 text-[13px] font-extrabold text-bakery-dark">Dziennik</Link>
      </div>
      {changes.length === 0 ? (
        <p className="m-0 px-5 pb-4 text-sm font-semibold text-[#5f5a58]">Brak zapisanych zmian.</p>
      ) : (
        <ol className="m-0 p-0 list-none">
          {changes.map((change) => (
            <li key={change.entry_id} className="flex flex-col gap-0.5 px-5 py-2.5 border-t border-[#e6e1df]">
              <span className="text-[13px] font-bold">{change.description}</span>
              <span className="text-xs font-semibold text-[#5f5a58]">
                {change.actor_name || 'System'} · {changeTime(change.created_at, today)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}