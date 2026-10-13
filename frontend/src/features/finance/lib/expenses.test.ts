import { describe, expect, it } from 'vitest';
import type { AppExpense, RecurringExpense } from '../../../services/api';
import {
  countLabel,
  cycleProgress,
  daysUntilLabel,
  firstAutomaticPayment,
  groupExpensesByDay,
  paymentDayLabel,
  summarizeByCategory,
} from './expenses';

function expense(id: number, date: string, category: string, amount: string): AppExpense {
  return { expense_id: id, category, category_label: category, amount, description: '', date };
}

function recurring(previous: string | null, next: string | null, daysUntil: number | null): RecurringExpense {
  return {
    recurring_id: 1,
    category: 'rent',
    category_label: 'Czynsz',
    amount: '4500.00',
    description: 'Czynsz',
    day_of_month: 1,
    is_active: next !== null,
    next_date: next,
    previous_date: previous,
    days_until_next: daysUntil,
  };
}

describe('summarizeByCategory', () => {
  it('returns every category in fixed order with totals and counts', () => {
    const summary = summarizeByCategory([
      expense(1, '2026-10-10', 'fuel', '205.00'),
      expense(2, '2026-10-07', 'fuel', '95.50'),
      expense(3, '2026-10-01', 'rent', '1360.00'),
    ]);

    expect(summary.map((s) => [s.value, s.total, s.count])).toEqual([
      ['salary', 0, 0],
      ['rent', 1360, 1],
      ['utility', 0, 0],
      ['fuel', 300.5, 2],
      ['other', 0, 0],
    ]);
  });
});

describe('groupExpensesByDay', () => {
  it('groups consecutive expenses of the same day and sums them', () => {
    const days = groupExpensesByDay([
      expense(3, '2026-10-10', 'fuel', '205.00'),
      expense(2, '2026-10-10', 'salary', '4770.00'),
      expense(1, '2026-10-07', 'fuel', '89.00'),
    ]);

    expect(days.map((d) => [d.date, d.total, d.items.map((e) => e.expense_id)])).toEqual([
      ['2026-10-10', 4975, [3, 2]],
      ['2026-10-07', 89, [1]],
    ]);
  });
});

describe('labels', () => {
  it.each([
    [1, '1 wydatek'],
    [3, '3 wydatki'],
    [12, '12 wydatków'],
    [22, '22 wydatki'],
  ])('counts %i', (count, expected) => {
    expect(countLabel(count)).toBe(expected);
  });

  it('describes payment day and time left', () => {
    expect(paymentDayLabel(10)).toBe('10. dnia miesiąca');
    expect(paymentDayLabel(31)).toBe('ostatniego dnia miesiąca');
    expect([0, 1, 19].map(daysUntilLabel)).toEqual(['dziś', 'jutro', 'za 19 dni']);
  });
});

describe('cycleProgress', () => {
  it('measures the part of the month already passed', () => {
    expect(cycleProgress(recurring('2026-10-01', '2026-10-31', 15))).toBe(50);
    expect(cycleProgress(recurring('2026-10-01', '2026-10-31', 30))).toBe(0);
  });

  it('is empty for paused templates', () => {
    expect(cycleProgress(recurring(null, null, null))).toBe(0);
  });
});

describe('firstAutomaticPayment', () => {
  it.each([
    ['2026-10-11', 1, '2026-11-01'],
    ['2026-10-11', 20, '2026-11-20'],
    ['2026-10-11', 11, '2026-11-11'],
    ['2026-01-15', 31, '2026-02-28'],
    ['2026-12-05', 10, '2027-01-10'],
  ])('expense on %s, payment day %i → %s', (expenseDate, day, expected) => {
    expect(firstAutomaticPayment(expenseDate, day)).toBe(expected);
  });
});