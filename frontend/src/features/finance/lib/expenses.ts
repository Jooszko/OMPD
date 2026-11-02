import type { AppExpense, RecurringExpense } from '../../../services/api';
import { toIsoDate } from '../../dashboard/lib/dateFormat';
export const EXPENSE_CATEGORIES: { value: string; label: string }[] = [
  { value: 'salary', label: 'Wynagrodzenia' },
  { value: 'rent', label: 'Czynsz' },
  { value: 'utility', label: 'Media' },
  { value: 'fuel', label: 'Paliwo' },
  { value: 'other', label: 'Inne' },
];

export interface CategorySummary {
  value: string;
  label: string;
  total: number;
  count: number;
}

export function summarizeByCategory(expenses: AppExpense[]): CategorySummary[] {
  return EXPENSE_CATEGORIES.map(({ value, label }) => {
    const inCategory = expenses.filter((expense) => expense.category === value);
    return {
      value,
      label,
      total: inCategory.reduce((sum, expense) => sum + Number(expense.amount), 0),
      count: inCategory.length,
    };
  });
}

export interface ExpenseDay {
  date: string;
  total: number;
  items: AppExpense[];
}

export function groupExpensesByDay(expenses: AppExpense[]): ExpenseDay[] {
  const days: ExpenseDay[] = [];
  for (const expense of expenses) {
    let day = days[days.length - 1];
    if (!day || day.date !== expense.date) {
      day = { date: expense.date, total: 0, items: [] };
      days.push(day);
    }
    day.total += Number(expense.amount);
    day.items.push(expense);
  }
  return days;
}

export function countLabel(count: number): string {
  if (count === 1) return '1 wydatek';
  const last = count % 10;
  const lastTwo = count % 100;
  return `${count} ${last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? 'wydatki' : 'wydatków'}`;
}

export function paymentDayLabel(dayOfMonth: number): string {
  return dayOfMonth === 31 ? 'ostatniego dnia miesiąca' : `${dayOfMonth}. dnia miesiąca`;
}

export function daysUntilLabel(days: number): string {
  if (days === 0) return 'dziś';
  if (days === 1) return 'jutro';
  return `za ${days} dni`;
}

export function cycleProgress(recurring: RecurringExpense): number {
  if (!recurring.next_date || !recurring.previous_date || recurring.days_until_next === null) return 0;
  const cycle = Math.round(
    (new Date(`${recurring.next_date}T00:00:00`).getTime() - new Date(`${recurring.previous_date}T00:00:00`).getTime()) /
      86_400_000
  );
  if (cycle <= 0) return 0;
  return Math.min(100, Math.max(0, ((cycle - recurring.days_until_next) / cycle) * 100));
}

function paymentInMonth(year: number, month: number, dayOfMonth: number): Date {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(dayOfMonth, daysInMonth));
}

export function firstAutomaticPayment(expenseDate: string, dayOfMonth: number): string {
  const [year, month] = expenseDate.split('-').map(Number);
  return toIsoDate(paymentInMonth(year, month, dayOfMonth));
}