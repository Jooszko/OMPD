import { useState } from 'react';
import type { AppExpense } from '../../../services/api';
import { formatDayLabel } from '../../dashboard/lib/dateFormat';
import { categoryColors } from '../lib/categories';
import { groupExpensesByDay } from '../lib/expenses';
import { formatMoney } from '../lib/money';

const ICON_BUTTON =
  'w-10 h-10 inline-flex items-center justify-center rounded-[10px] border border-transparent text-[#4a4543] hover:bg-bakery-rowBg hover:border-bakery-btnBorder hover:text-bakery-dark disabled:opacity-40';

function ExpenseRow({
  expense,
  busy,
  onEdit,
  onDelete,
}: {
  expense: AppExpense;
  busy: boolean;
  onEdit?: (expense: AppExpense) => void;
  onDelete: (expense: AppExpense) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const colors = categoryColors(expense.category);
  const title = expense.description || expense.category_label;

  return (
    <li
      className={`flex flex-wrap items-center gap-x-3.5 gap-y-2 py-3 border-b border-bakery-rowBg last:border-b-0 ${
        confirming ? 'bg-[#fbdcdc] -mx-2 px-2 rounded-lg' : ''
      }`}
    >
      <span
        aria-hidden
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: colors.tint }}
      >
        <span className="w-3.5 h-3.5 rounded" style={{ background: colors.color }} />
      </span>
      <span className="flex-[1_1_220px] min-w-0 flex flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 text-[15px] font-extrabold">
          <span className="truncate">{title}</span>
          {expense.recurring_id && (
            <span className="px-2 py-0.5 rounded-full bg-[#fff3dc] border border-[#f3c56f] text-[11px] font-extrabold text-[#5c3b06]">
              co miesiąc
            </span>
          )}
        </span>
        <span className="text-xs font-semibold text-[#5f5a58]">
          {expense.category_label}
          {expense.created_by && ` · dodał(a) ${expense.created_by}`}
        </span>
      </span>
      <span className="ml-auto text-base font-extrabold tabular-nums whitespace-nowrap">
        {formatMoney(-Number(expense.amount), { cents: true })}
      </span>
      <span className="flex items-center justify-end gap-1 min-w-[88px]">
        {confirming ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-extrabold">
            Usunąć?
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="h-9 px-3 rounded-[10px] border border-bakery-btnBorder bg-white text-[13px] font-extrabold"
            >
              Nie
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDelete(expense)}
              className="h-9 px-3 rounded-[10px] border border-[#b91c1c] bg-[#b91c1c] text-white text-[13px] font-extrabold disabled:opacity-50"
            >
              Tak
            </button>
          </span>
        ) : (
          <>
            {onEdit && (
              <button type="button" aria-label={`Edytuj: ${title}`} onClick={() => onEdit(expense)} className={ICON_BUTTON}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 20h4L19 9l-4-4L4 16z" />
                  <path d="M13.5 6.5l4 4" />
                </svg>
              </button>
            )}
            <button
              type="button"
              aria-label={`Usuń: ${title}`}
              disabled={busy}
              onClick={() => setConfirming(true)}
              className={ICON_BUTTON}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 7h16" />
                <path d="M9 7V4h6v3" />
                <path d="M6 7l1 13h10l1-13" />
              </svg>
            </button>
          </>
        )}
      </span>
    </li>
  );
}

export function ExpenseList({
  expenses,
  busyId,
  onEdit,
  onDelete,
}: {
  expenses: AppExpense[];
  busyId: number | null;
  onEdit?: (expense: AppExpense) => void;
  onDelete: (expense: AppExpense) => void;
}) {
  if (expenses.length === 0) {
    return (
      <section className="bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm p-6">
        <p className="m-0 text-sm font-semibold text-[#5f5a58] italic">Brak wydatków w tym okresie.</p>
      </section>
    );
  }

  return (
    <section className="bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm px-5 sm:px-6 pt-2 pb-4 flex flex-col">
      {groupExpensesByDay(expenses).map((day) => (
        <div key={day.date} className="pt-4 flex flex-col">
          <div className="flex items-baseline justify-between gap-2 pb-2 border-b border-[#d9d4d2] tabular-nums">
            <span className="text-sm font-extrabold first-letter:uppercase">{formatDayLabel(day.date)}</span>
            <span className="text-[13px] font-bold text-[#5f5a58]">{formatMoney(-day.total, { cents: true })}</span>
          </div>
          <ul className="m-0 p-0 list-none">
            {day.items.map((expense) => (
              <ExpenseRow
                key={expense.expense_id}
                expense={expense}
                busy={busyId === expense.expense_id}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </ul>
        </div>
      ))}
      <p className="m-0 mt-3.5 text-xs font-semibold text-[#5f5a58]">
        Każda edycja i usunięcie trafia do dziennika zmian z kwotą „było → jest”.
      </p>
    </section>
  );
}