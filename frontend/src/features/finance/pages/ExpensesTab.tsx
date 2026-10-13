import { useEffect, useState } from 'react';
import {
  deleteExpense,
  deleteRecurringExpense,
  fetchPeriodExpenses,
  fetchRecurringExpenses,
  updateRecurringExpense,
  type AppExpense,
  type RecurringExpense,
  type RecurringExpenseList,
} from '../../../services/api';
import { CategoryCards } from '../components/CategoryCards';
import { ExpenseList } from '../components/ExpenseList';
import { ExpenseModal, type ExpenseModalMode } from '../components/ExpenseModal';
import { RecurringPanel } from '../components/RecurringPanel';
import { summarizeByCategory } from '../lib/expenses';
import { useFinancePeriod } from '../lib/financeContext';

interface LoadedExpenses {
  key: string;
  expenses: AppExpense[];
  recurring: RecurringExpenseList;
  error: string | null;
}

export default function ExpensesTab() {
  const period = useFinancePeriod();
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<LoadedExpenses | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [modal, setModal] = useState<ExpenseModalMode | null>(null);
  const key = `${period.start}|${period.end}|${version}`;

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchPeriodExpenses(period.start, period.end), fetchRecurringExpenses()])
      .then(([expenses, recurring]) => {
        if (!cancelled) setLoaded({ key, expenses, recurring, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setLoaded({ key, expenses: [], recurring: { monthly_total: '0', items: [] }, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [period.start, period.end, key]);

  const runAction = async (busyKey: string, action: () => Promise<unknown>) => {
    setBusy(busyKey);
    setActionError(null);
    try {
      await action();
      setVersion((value) => value + 1);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Nie udało się zapisać zmiany.');
    } finally {
      setBusy(null);
    }
  };

  const current = loaded?.key === key ? loaded : null;
  const isRefetching = !current && loaded !== null;

  if (current?.error) {
    return <p className="m-0 text-sm font-semibold text-rose-700">Nie udało się pobrać wydatków: {current.error}</p>;
  }

  if (!loaded) {
    return (
      <div className="flex flex-col gap-4" aria-label="Wczytywanie wydatków">
        <div className="h-[260px] rounded-[18px] bg-bakery-inactive animate-pulse" />
        <div className="h-[120px] rounded-[14px] bg-bakery-inactive animate-pulse" />
      </div>
    );
  }

  const busyIdOf = (prefix: 'expense' | 'recurring') =>
    busy?.startsWith(`${prefix}-`) ? Number(busy.slice(prefix.length + 1)) : null;
  const visible = category ? loaded.expenses.filter((expense) => expense.category === category) : loaded.expenses;

  return (
    <div className={`flex flex-col gap-5 transition-opacity ${isRefetching ? 'opacity-60' : ''}`} aria-busy={isRefetching}>
      {actionError && (
        <p role="alert" className="m-0 px-4 py-3 rounded-xl bg-[#fbdcdc] text-sm font-semibold text-[#991b1b]">
          {actionError}
        </p>
      )}

      <RecurringPanel
        data={loaded.recurring}
        busyId={busyIdOf('recurring')}
        onAdd={() => setModal({ kind: 'create', repeat: true })}
        onEdit={(item) => setModal({ kind: 'recurring', item })}
        onToggle={(item: RecurringExpense) =>
          runAction(`recurring-${item.recurring_id}`, () =>
            updateRecurringExpense(item.recurring_id, { is_active: !item.is_active })
          )
        }
        onDelete={(item: RecurringExpense) =>
          runAction(`recurring-${item.recurring_id}`, () => deleteRecurringExpense(item.recurring_id))
        }
      />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="m-0 text-lg font-extrabold">Wydatki w okresie</h2>
            <span className="text-[13px] font-semibold text-[#4a4543]">Kliknij kategorię, aby pokazać tylko jej wydatki.</span>
          </div>
          <button
            type="button"
            onClick={() => setModal({ kind: 'create', repeat: false })}
            className="h-11 px-[18px] inline-flex items-center gap-2 rounded-xl border border-bakery-accent bg-bakery-accent text-sm font-extrabold text-bakery-dark"
          >
            <span aria-hidden className="text-lg leading-none">+</span>
            Dodaj wydatek
          </button>
        </div>
        <CategoryCards summary={summarizeByCategory(loaded.expenses)} selected={category} onSelect={setCategory} />
      </section>

      <ExpenseList
        expenses={visible}
        busyId={busyIdOf('expense')}
        onEdit={(expense) => setModal({ kind: 'edit', expense })}
        onDelete={(expense) => runAction(`expense-${expense.expense_id}`, () => deleteExpense(expense.expense_id))}
      />

      {modal && (
        <ExpenseModal
          mode={modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            setVersion((value) => value + 1);
          }}
        />
      )}
    </div>
  );
}