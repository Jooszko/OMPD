import { Link } from 'react-router-dom';
import type { AppExpense } from '../../../services/api';
import { formatDayLabel } from '../../dashboard/lib/dateFormat';
import { categoryColors } from '../lib/categories';
import { formatMoney } from '../lib/money';

function groupByDate(expenses: AppExpense[]): { date: string; items: AppExpense[] }[] {
  const groups: { date: string; items: AppExpense[] }[] = [];
  for (const expense of expenses) {
    const last = groups[groups.length - 1];
    if (last?.date === expense.date) last.items.push(expense);
    else groups.push({ date: expense.date, items: [expense] });
  }
  return groups;
}

export function RecentExpenses({ expenses }: { expenses: AppExpense[] }) {
  return (
    <section className="flex-[1_1_340px] min-w-0 bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm p-5 sm:p-6 flex flex-col gap-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="m-0 text-lg font-extrabold whitespace-nowrap">Ostatnie wydatki</h2>
        <Link to="/finance/expenses" className="text-[13px] font-extrabold text-bakery-dark whitespace-nowrap">
          Wszystkie wydatki →
        </Link>
      </div>

      {expenses.length === 0 ? (
        <p className="m-0 text-sm font-semibold text-[#5f5a58] italic">Brak wydatków w tym okresie.</p>
      ) : (
        groupByDate(expenses).map((group) => (
          <div key={group.date} className="flex flex-col gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]">
              {formatDayLabel(group.date)}
            </span>
            {group.items.map((expense) => {
              const colors = categoryColors(expense.category);
              return (
                <div
                  key={expense.expense_id}
                  className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-white border border-[#e6e1df]"
                >
                  <span
                    aria-hidden
                    className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                    style={{ background: colors.tint }}
                  >
                    <span className="w-3 h-3 rounded" style={{ background: colors.color }} />
                  </span>
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="text-sm font-extrabold truncate">
                      {expense.description || expense.category_label}
                    </span>
                    <span className="text-xs font-semibold text-[#5f5a58]">{expense.category_label}</span>
                  </span>
                  <span className="text-sm font-extrabold tabular-nums whitespace-nowrap">
                    {formatMoney(-Number(expense.amount), { cents: true })}
                  </span>
                </div>
              );
            })}
          </div>
        ))
      )}
    </section>
  );
}