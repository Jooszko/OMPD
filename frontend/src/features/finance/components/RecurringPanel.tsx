import { useState } from 'react';
import type { RecurringExpense, RecurringExpenseList } from '../../../services/api';
import { categoryColors } from '../lib/categories';
import { cycleProgress, daysUntilLabel, paymentDayLabel } from '../lib/expenses';
import { formatMoney } from '../lib/money';

const DARK_BUTTON =
  'flex-1 h-10 rounded-[10px] border border-[#4a4543] bg-transparent text-white text-[13px] font-extrabold hover:bg-white/10 disabled:opacity-50';

function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${day}.${month}`;
}

function RecurringCard({
  item,
  busy,
  onEdit,
  onToggle,
  onDelete,
}: {
  item: RecurringExpense;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const colors = categoryColors(item.category);

  return (
    <li
      className={`p-[18px] rounded-[14px] bg-[#262322] border border-[#3a3533] flex flex-col gap-3 ${
        item.is_active ? '' : 'opacity-70'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-[13px] font-extrabold text-[#e7e2df]">
          <span aria-hidden className="w-3 h-3 rounded" style={{ background: colors.color }} />
          {item.category_label}
        </span>
        <span
          className={`px-2.5 py-[3px] rounded-full text-[11px] font-extrabold ${
            item.is_active ? 'bg-[#1f4d2e] text-[#bbf7d0]' : 'bg-[#3a3533] text-[#cfc8c4]'
          }`}
        >
          {item.is_active ? 'Aktywny' : 'Wstrzymany'}
        </span>
      </div>

      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[15px] font-extrabold truncate">{item.description || item.category_label}</span>
        <span className="font-display text-[26px] font-extrabold tabular-nums">{formatMoney(item.amount, { cents: true })}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between gap-2 text-xs font-bold text-[#cfc8c4] tabular-nums">
          <span>{paymentDayLabel(item.day_of_month)}</span>
          <span>
            {item.next_date && item.days_until_next !== null
              ? `następny ${shortDate(item.next_date)} · ${daysUntilLabel(item.days_until_next)}`
              : 'wstrzymany'}
          </span>
        </div>
        <div aria-hidden className="h-1.5 rounded-full bg-[#3a3533]">
          <div className="h-full rounded-full bg-bakery-accent" style={{ width: `${cycleProgress(item)}%` }} />
        </div>
      </div>

      {confirming ? (
        <div className="flex items-center gap-2 text-[13px] font-extrabold">
          <span className="flex-1">Usunąć szablon?</span>
          <button type="button" onClick={() => setConfirming(false)} className={DARK_BUTTON}>
            Nie
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            className="flex-1 h-10 rounded-[10px] border border-[#b91c1c] bg-[#b91c1c] text-white text-[13px] font-extrabold disabled:opacity-50"
          >
            Tak
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={onEdit} className={DARK_BUTTON}>
            Edytuj
          </button>
          <button type="button" disabled={busy} onClick={onToggle} className={DARK_BUTTON}>
            {item.is_active ? 'Wstrzymaj' : 'Wznów'}
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirming(true)} className={DARK_BUTTON}>
            Usuń
          </button>
        </div>
      )}
    </li>
  );
}

export function RecurringPanel({
  data,
  busyId,
  onAdd,
  onEdit,
  onToggle,
  onDelete,
}: {
  data: RecurringExpenseList;
  busyId: number | null;
  onAdd: () => void;
  onEdit: (item: RecurringExpense) => void;
  onToggle: (item: RecurringExpense) => void;
  onDelete: (item: RecurringExpense) => void;
}) {
  return (
    <section aria-labelledby="recurring-title" className="p-5 sm:p-6 rounded-[18px] bg-bakery-dark text-white flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#f7b64f]">Wydatki cykliczne</span>
          <h2 id="recurring-title" className="m-0 font-display text-[28px] font-extrabold tabular-nums">
            {formatMoney(data.monthly_total)}{' '}
            <span className="font-auth text-[15px] font-bold text-[#cfc8c4]">miesięcznie, dodawane automatycznie</span>
          </h2>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="h-11 px-4 rounded-xl border border-[#4a4543] bg-transparent text-white text-sm font-extrabold hover:bg-white/10"
        >
          + Nowy cykliczny
        </button>
      </div>

      {data.items.length === 0 ? (
        <p className="m-0 text-sm font-semibold text-[#cfc8c4]">
          Brak wydatków cyklicznych. Dodaj wydatek i zaznacz „Powtarzaj co miesiąc”, a czynsz czy pensje będą się dodawać
          same.
        </p>
      ) : (
        <ul className="m-0 p-0 list-none grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
          {data.items.map((item) => (
            <RecurringCard
              key={item.recurring_id}
              item={item}
              busy={busyId === item.recurring_id}
              onEdit={() => onEdit(item)}
              onToggle={() => onToggle(item)}
              onDelete={() => onDelete(item)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}