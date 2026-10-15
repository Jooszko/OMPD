import { useState, type FormEvent } from 'react';
import {
  addExpense,
  updateExpense,
  updateRecurringExpense,
  type AppExpense,
  type RecurringExpense,
} from '../../../services/api';
import { Modal } from '../../dashboard/components/Modal';
import { toIsoDate } from '../../dashboard/lib/dateFormat';
import { categoryColors } from '../lib/categories';
import { EXPENSE_CATEGORIES, firstAutomaticPayment, paymentDayLabel } from '../lib/expenses';

export type ExpenseModalMode =
  | { kind: 'create'; repeat: boolean }
  | { kind: 'edit'; expense: AppExpense }
  | { kind: 'recurring'; item: RecurringExpense };

const FIELD_CLASS =
  'w-full h-12 px-3.5 rounded-xl border-[1.5px] border-bakery-btnBorder bg-white text-[15px] font-semibold text-bakery-dark outline-none focus:border-bakery-accent';
const LABEL_CLASS = 'flex flex-col gap-1.5 text-xs font-extrabold text-[#3d3937]';
const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year}`;
}

function initialForm(mode: ExpenseModalMode) {
  const today = toIsoDate(new Date());
  if (mode.kind === 'edit') {
    const { expense } = mode;
    return { category: expense.category, amount: expense.amount.replace('.', ','), date: expense.date, description: expense.description, repeat: false, day: 1 };
  }
  if (mode.kind === 'recurring') {
    const { item } = mode;
    return { category: item.category, amount: item.amount.replace('.', ','), date: today, description: item.description, repeat: true, day: item.day_of_month };
  }
  return { category: 'other', amount: '', date: today, description: '', repeat: mode.repeat, day: new Date().getDate() };
}

const TITLES: Record<ExpenseModalMode['kind'], { title: string; subtitle: string }> = {
  create: { title: 'Nowy wydatek', subtitle: 'Trafi do kosztów operacyjnych z wybranego dnia.' },
  edit: { title: 'Edycja wydatku', subtitle: 'Zmiana trafi do dziennika zmian.' },
  recurring: { title: 'Wydatek cykliczny', subtitle: 'Zmiana dotyczy kolejnych miesięcy. Dodane już wydatki zostają bez zmian.' },
};

export function ExpenseModal({ mode, onClose, onSaved }: { mode: ExpenseModalMode; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(() => initialForm(mode));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = toIsoDate(new Date());
  const showDate = mode.kind !== 'recurring';
  const showDay = mode.kind === 'recurring' || (mode.kind === 'create' && form.repeat);

  const update = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) =>
    setForm((previous) => ({ ...previous, [field]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const fields = { category: form.category, amount: form.amount.trim(), description: form.description.trim() };
    try {
      if (mode.kind === 'create') {
        await addExpense({
          ...fields,
          date: form.date,
          ...(form.repeat ? { repeat_monthly: true, day_of_month: form.day } : {}),
        });
      } else if (mode.kind === 'edit') {
        await updateExpense(mode.expense.expense_id, { ...fields, date: form.date });
      } else {
        await updateRecurringExpense(mode.item.recurring_id, { ...fields, day_of_month: form.day });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać wydatku.');
      setSaving(false);
    }
  };

  const { title, subtitle } = TITLES[mode.kind];
  const submitLabel =
    mode.kind === 'create' ? (form.repeat ? 'Dodaj i powtarzaj' : 'Dodaj wydatek') : 'Zapisz zmiany';

  return (
    <Modal title={title} subtitle={subtitle} closeDisabled={saving} initialFocusSelector="#expense-amount" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4 font-auth">
        <fieldset className="m-0 p-0 border-0 flex flex-col gap-2">
          <legend className="mb-2 text-xs font-extrabold text-[#3d3937]">Kategoria</legend>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(128px,1fr))] gap-2">
            {EXPENSE_CATEGORIES.map((category) => {
              const active = form.category === category.value;
              return (
                <button
                  key={category.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => update('category', category.value)}
                  className={`h-12 px-3 flex items-center gap-2 rounded-xl text-[13px] font-extrabold text-bakery-dark ${
                    active ? 'bg-white border-2 border-bakery-dark' : 'bg-[#f3efed] border border-[#e0dbd9]'
                  }`}
                >
                  <span aria-hidden className="w-3 h-3 rounded shrink-0" style={{ background: categoryColors(category.value).color }} />
                  {category.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className={`grid gap-3 ${showDate ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <label className={LABEL_CLASS}>
            Kwota
            <span className="relative flex">
              <input
                id="expense-amount"
                required
                inputMode="decimal"
                placeholder="0,00"
                value={form.amount}
                onChange={(e) => update('amount', e.target.value)}
                className={`${FIELD_CLASS} pr-11 text-xl font-extrabold tabular-nums`}
              />
              <span aria-hidden className="absolute right-3.5 top-3.5 text-[15px] font-bold text-[#5f5a58]">
                zł
              </span>
            </span>
          </label>
          {showDate && (
            <label className={LABEL_CLASS}>
              Data
              <input
                type="date"
                required
                max={today}
                value={form.date}
                onChange={(e) => e.target.value && update('date', e.target.value)}
                className={FIELD_CLASS}
              />
            </label>
          )}
        </div>

        <label className={LABEL_CLASS}>
          Opis
          <input
            maxLength={255}
            placeholder="np. Faktura 123/10/2026 – prąd"
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            className={FIELD_CLASS}
          />
        </label>

        {mode.kind === 'edit' && mode.expense.recurring_id && (
          <p className="m-0 px-3.5 py-2.5 rounded-xl bg-[#fff3dc] text-[13px] font-semibold text-[#5c3b06]">
            To wydatek cykliczny. Zmiana dotyczy tylko tego miesiąca – kwotę na kolejne miesiące zmienisz w panelu wydatków
            cyklicznych.
          </p>
        )}

        {(mode.kind === 'create' || showDay) && (
          <div
            className={`px-4 py-3.5 rounded-[14px] border-[1.5px] flex flex-col gap-3 ${
              form.repeat ? 'bg-[#fff7e8] border-bakery-accent' : 'bg-white border-[#e0dbd9]'
            }`}
          >
            {mode.kind === 'create' && (
              <label className="flex items-center gap-3 min-h-11 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.repeat}
                  onChange={(e) => update('repeat', e.target.checked)}
                  className="w-5 h-5 m-0 accent-bakery-dark"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-extrabold">Powtarzaj co miesiąc</span>
                  <span className="text-xs font-semibold text-[#5f5a58]">Dla stałych kosztów: czynsz, pensje, leasing, abonamenty.</span>
                </span>
              </label>
            )}
            {showDay && (
              <label className="flex flex-wrap items-center gap-2.5 text-[13px] font-bold text-[#3d3937]">
                {mode.kind === 'create' ? 'Dodawaj automatycznie' : 'Dzień płatności:'}
                <select
                  value={form.day}
                  onChange={(e) => update('day', Number(e.target.value))}
                  className="h-10 px-2.5 rounded-[10px] border-[1.5px] border-bakery-btnBorder bg-white text-sm font-extrabold"
                >
                  {DAYS.map((day) => (
                    <option key={day} value={day}>
                      {day === 31 ? 'ostatniego' : `${day}.`}
                    </option>
                  ))}
                </select>
                {mode.kind === 'create'
                  ? `dnia miesiąca · pierwszy raz ${formatDate(firstAutomaticPayment(form.date, form.day))}`
                  : `(${paymentDayLabel(form.day)})`}
              </label>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="m-0 px-3.5 py-2.5 rounded-xl bg-[#fbdcdc] text-[13px] font-semibold text-[#991b1b]">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2.5 pt-1">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="h-12 px-5 rounded-xl border border-bakery-btnBorder bg-white text-sm font-extrabold text-bakery-dark disabled:opacity-50"
          >
            Anuluj
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-12 px-6 rounded-xl border border-bakery-accent bg-bakery-accent text-sm font-extrabold text-bakery-dark disabled:opacity-60"
          >
            {saving ? 'Zapisywanie…' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}