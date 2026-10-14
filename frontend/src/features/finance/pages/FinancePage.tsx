import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { PeriodPicker } from '../components/PeriodPicker';
import type { FinanceContext } from '../lib/financeContext';
import { periodLabel, presetPeriod, type FinancePeriod } from '../lib/period';

const TABS = [
  { to: '/finance', label: 'Przegląd', end: true },
  { to: '/finance/expenses', label: 'Wydatki', end: false },
  { to: '/finance/profitability', label: 'Rentowność produktów', end: false },
  { to: '/finance/reports', label: 'Raporty', end: false },
];

const PERIOD_TABS = ['/finance', '/finance/expenses', '/finance/profitability'];

export default function FinancePage() {
  const [period, setPeriod] = useState<FinancePeriod>(() => presetPeriod('30'));
  const { pathname } = useLocation();
  const showPeriod = PERIOD_TABS.includes(pathname.replace(/\/$/, ''));

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5 font-auth text-bakery-dark">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 font-display text-[34px] leading-none font-extrabold tracking-[-0.02em]">Finanse</h1>
          <p className="m-0 text-sm text-[#4a4543]">Przychody, koszty i zysk piekarni w wybranym okresie.</p>
        </div>
        {showPeriod && (
          <div className="flex flex-wrap items-center gap-3">
            <PeriodPicker value={period} onChange={setPeriod} />
            <span className="text-[13px] font-bold text-[#4a4543] tabular-nums">{periodLabel(period.start, period.end)}</span>
          </div>
        )}
      </div>

      <nav aria-label="Sekcje finansów" className="flex flex-wrap gap-x-7 border-b border-[#b4aeae]">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `inline-flex items-center min-h-11 px-1 text-sm font-bold no-underline border-b-[3px] ${
                isActive
                  ? 'text-bakery-dark border-bakery-accent'
                  : 'text-[#5f5a58] border-transparent hover:text-bakery-dark'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet context={{ period } satisfies FinanceContext} />
    </div>
  );
}