import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import type { HomeData, HomeOrderStatus, ProductionStage } from '../../../services/api';
import { changeVsPrevious, formatMoney } from '../../finance/lib/money';
import {
  alertView,
  daySummary,
  formatHeroDate,
  greeting,
  shiftSummary,
  STAGE_ORDER,
  trendBars,
  type Segment,
} from '../lib/home';
import { DayRing, type RingPart } from './DayRing';

export type HomeView = 'admin' | 'baker';

const ORDER_PARTS: RingPart<HomeOrderStatus>[] = [
  { key: 'delivered', label: 'Dostarczone', color: '#3fb565' },
  { key: 'in_delivery', label: 'W dostawie', color: '#5b9be6' },
  { key: 'in_production', label: 'W produkcji', color: '#f49f1c' },
  { key: 'planned', label: 'Zaplanowane', color: '#8a8381' },
  { key: 'failed', label: 'Nieudane', color: '#ff6b6b' },
];

const STAGE_LABELS: Record<ProductionStage, string> = {
  done: 'Gotowe',
  baking: 'Wypiek',
  proofing: 'Garowanie',
  dividing: 'Dzielenie',
  mixing: 'Mieszanie',
};

const STAGE_COLORS: Record<ProductionStage, string> = {
  done: '#3fb565',
  baking: '#f49f1c',
  proofing: '#5b9be6',
  dividing: '#c4a7e7',
  mixing: '#8a8381',
};

const STAGE_PARTS: RingPart<ProductionStage>[] = STAGE_ORDER.map((stage) => ({
  key: stage,
  label: STAGE_LABELS[stage],
  color: STAGE_COLORS[stage],
}));

const BAKER_ALERTS = new Set(['low_stock', 'missing_plan']);

const TONE_CLASS = {
  good: 'text-[#7fd69b]',
  bad: 'text-[#ff9b9b]',
  neutral: 'text-[#bdb5b2]',
};

function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function Sentence({ segments }: { segments: Segment[] }) {
  return (
    <p className="m-0 max-w-[560px] text-[15px] sm:text-[17px] leading-normal font-semibold text-[#d9d2cf]">
      {segments.map((segment, index) =>
        segment.strong ? (
          <strong key={index} className="text-white">{segment.text}</strong>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
    </p>
  );
}

function AlertChips({ data, view }: { data: HomeData; view: HomeView }) {
  const alerts = data.alerts
    .filter((alert) => view === 'admin' || BAKER_ALERTS.has(alert.kind))
    .map(alertView);
  if (alerts.length === 0) {
    return (
      <span className="inline-flex items-center gap-2 min-h-10 px-3.5 rounded-full bg-[#173a24] text-[#b9f0c9] text-[13px] font-extrabold">
        <Check aria-hidden className="size-4" />
        Nic nie wymaga uwagi
      </span>
    );
  }
  return (
    <>
      {alerts.map((alert) => (
        <Link
          key={alert.key}
          to={alert.href}
          title={alert.detail}
          aria-label={`${alert.title}. ${alert.detail}`}
          className={`inline-flex items-center gap-2 min-h-10 px-3.5 rounded-full text-[13px] font-extrabold no-underline transition hover:brightness-125 ${
            alert.tone === 'critical' ? 'bg-[#4a1d1d] text-[#ffd6d6]' : 'bg-[#4a3410] text-[#ffe2b0]'
          }`}
        >
          <span aria-hidden className={`size-2 rounded-full ${alert.tone === 'critical' ? 'bg-[#ff6b6b]' : 'bg-bakery-accent'}`} />
          {alert.title}
        </Link>
      ))}
    </>
  );
}

function RevenueCard({ data }: { data: HomeData }) {
  const finance = data.finance;
  if (!finance) return null;
  const change = changeVsPrevious(finance.revenue, finance.average_revenue, 'income');
  const bars = trendBars(finance.trend);
  return (
    <div className="relative flex-[1_1_220px] flex flex-col gap-2.5 px-5 py-[18px] rounded-[18px] bg-[#262221]">
      <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#bdb5b2]">Przychód dziś</span>
      <span className="font-display text-[38px] leading-none font-extrabold">{formatMoney(finance.revenue)}</span>
      <span className="flex flex-col gap-0.5 text-[13px] font-extrabold">
        <span>
          <span className={TONE_CLASS[change.tone]}>{change.label}</span>
          <span className="text-[#bdb5b2]"> vs średnia 7 dni</span>
        </span>
        <span className="text-[#d9d2cf]">Zysk {formatMoney(finance.net_profit, { cents: true })}</span>
      </span>
      <div
        role="img"
        aria-label={`Przychód z ostatnich ${bars.length} dni, dziś ${formatMoney(finance.revenue, { cents: true })}`}
        className="flex items-end gap-[5px] h-11"
      >
        {bars.map((bar) => (
          <span
            key={bar.date}
            title={`${bar.label}: ${formatMoney(bar.value, { cents: true })}`}
            className={`flex-1 rounded-t-[3px] ${bar.today ? 'bg-bakery-accent' : 'bg-[#4a4442]'}`}
            style={{ height: `${bar.height}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function IngredientsCard({ data }: { data: HomeData }) {
  const ingredients = data.production.ingredients.slice(0, 5);
  return (
    <div className="relative flex-[1_1_220px] flex flex-col gap-2 px-5 py-[18px] rounded-[18px] bg-[#262221]">
      <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#bdb5b2]">Surowce na zmianę</span>
      {ingredients.length === 0 ? (
        <span className="text-sm font-semibold text-[#bdb5b2]">Brak zamówień z recepturami.</span>
      ) : (
        <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
          {ingredients.map((item) => (
            <li key={item.name} className="flex justify-between gap-3 text-sm font-bold">
              <span>{item.name}</span>
              <span className="font-extrabold tabular-nums">
                {Number(item.amount).toLocaleString('pl-PL', { maximumFractionDigits: 2 })} {item.unit}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function HomeHero({ data, view }: { data: HomeData; view: HomeView }) {
  const now = useNow();
  const { orders, production } = data;
  const isAdmin = view === 'admin';
  const batches = production.batches.length;

  return (
    <section
      aria-label="Podsumowanie dnia"
      className="relative overflow-hidden rounded-[24px] bg-bakery-dark text-white px-5 py-6 sm:px-9 sm:py-8 flex flex-wrap items-center gap-x-12 gap-y-7"
    >
      <div aria-hidden className="absolute -right-[120px] -top-[160px] size-[420px] rounded-full border-[56px] border-[#262221]" />

      <div className="relative flex-[999_1_420px] min-w-0 flex flex-col gap-[18px]">
        <div className="flex flex-col gap-2">
          <span className="text-xs sm:text-[13px] font-extrabold uppercase tracking-[0.1em] text-bakery-accent">
            {formatHeroDate(now)}
          </span>
          <h1 className="m-0 font-display text-[34px] sm:text-[52px] leading-[0.95] font-extrabold tracking-[-0.03em]">
            {greeting(data.viewer.full_name, now.getHours())}
          </h1>
          <Sentence segments={isAdmin ? daySummary(orders) : shiftSummary(production)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {!isAdmin && (
            <Link
              to="/production/board"
              className="inline-flex items-center min-h-11 px-[18px] rounded-xl bg-bakery-accent text-bakery-dark text-sm font-extrabold no-underline"
            >
              Otwórz tablicę produkcji
            </Link>
          )}
          <AlertChips data={data} view={view} />
        </div>
      </div>

      {isAdmin ? (
        <DayRing
          counts={orders.by_status}
          parts={ORDER_PARTS}
          value={`${orders.by_status.delivered}/${orders.total}`}
          caption="dostarczone"
        />
      ) : (
        <DayRing
          counts={production.stages}
          parts={STAGE_PARTS}
          value={production.has_plan ? `${production.stages.done}/${batches}` : '—'}
          caption={production.has_plan ? 'dzieże gotowe' : 'brak planu'}
        />
      )}

      {isAdmin ? <RevenueCard data={data} /> : <IngredientsCard data={data} />}
    </section>
  );
}