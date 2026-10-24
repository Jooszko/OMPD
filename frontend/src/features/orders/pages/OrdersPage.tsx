import { useSearchParams } from 'react-router-dom';
import { CalendarDays, History, Repeat } from 'lucide-react';
import { DayView } from '../components/DayView';
import { HistoryView } from '../components/HistoryView';
import { StandingView } from '../components/StandingView';
import { isIsoDate, toIsoDate } from '../lib/orders';

type OrdersTab = 'day' | 'standing' | 'history';

const TABS: { key: OrdersTab; label: string; icon: typeof CalendarDays }[] = [
  { key: 'day', label: 'Dzień', icon: CalendarDays },
  { key: 'standing', label: 'Stałe', icon: Repeat },
  { key: 'history', label: 'Historia', icon: History },
];

export default function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const today = toIsoDate(new Date());
  const tab = TABS.find((item) => item.key === params.get('tab'))?.key ?? 'day';
  const dateParam = params.get('date');
  const date = isIsoDate(dateParam) ? dateParam : today;

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value === null ? next.delete(key) : next.set(key, value)));
    setParams(next, { replace: true });
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5 font-auth text-bakery-dark">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 font-display text-[34px] leading-none font-extrabold tracking-[-0.02em]">Zamówienia</h1>
          <p className="m-0 text-sm text-[#4a4543]">Zamówienia klientów na każdy dzień, harmonogramy stałe i historia.</p>
        </div>
        <div role="tablist" aria-label="Widok zamówień" className="flex gap-1 p-1 rounded-xl border border-bakery-btnBorder bg-bakery-card">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => update({ tab: item.key === 'day' ? null : item.key })}
                className={`inline-flex items-center gap-2 min-h-10 px-3.5 rounded-[10px] text-[13px] font-extrabold ${
                  active ? 'bg-bakery-dark text-white' : 'text-bakery-dark hover:bg-[#efebe9]'
                }`}
              >
                <Icon aria-hidden className={`w-4 h-4 ${active ? 'text-bakery-accent' : ''}`} />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'day' && (
        <DayView date={date} today={today} onDateChange={(next) => update({ date: next === today ? null : next })} />
      )}
      {tab === 'standing' && <StandingView />}
      {tab === 'history' && <HistoryView today={today} />}
    </div>
  );
}