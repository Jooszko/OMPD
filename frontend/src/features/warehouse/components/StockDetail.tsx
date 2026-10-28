import { ArrowDownLeft, ArrowUpRight, ClipboardCheck, Factory, PackageOpen, SlidersHorizontal } from 'lucide-react';
import type { ComponentType } from 'react';
import type { StockHistory, StockMovementKind } from '../../../services/api';
import { formatClock } from '../../home/lib/home';
import {
  formatDate,
  formatDays,
  formatQty,
  MOVEMENT_LABELS,
  PERIODS,
  type Period,
  STATUS_COLORS,
  STATUS_LABELS,
  type StockItem,
} from '../lib/warehouse';
import { StockChart } from './StockChart';

const MOVEMENT_ICONS: Record<StockMovementKind, ComponentType<{ className?: string }>> = {
  initial: PackageOpen,
  delivery: ArrowDownLeft,
  production: Factory,
  loss: ArrowUpRight,
  count: ClipboardCheck,
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex-[1_1_140px] min-w-0 flex flex-col gap-1 px-4 py-3 rounded-[14px] bg-white border border-[#e6e1df]">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]">{label}</span>
      <span className="font-display text-[22px] leading-none font-extrabold tabular-nums truncate">{value}</span>
      {hint && <span className="text-xs font-semibold text-[#5f5a58] truncate">{hint}</span>}
    </div>
  );
}

function Movements({ history, unit }: { history: StockHistory | null; unit: string }) {
  const movements = history?.movements.filter((m) => m.kind !== 'production').slice(0, 8) ?? [];
  const usedTotal = history?.series.reduce((sum, day) => sum + Number(day.used), 0) ?? 0;
  return (
    <section aria-labelledby="movements-title" className="flex-[1_1_280px] min-w-0 flex flex-col gap-2">
      <h3 id="movements-title" className="m-0 text-sm font-extrabold">Przyjęcia i korekty</h3>
      {history && (
        <p className="m-0 text-xs font-semibold text-[#5f5a58]">
          Produkcja zużyła {formatQty(usedTotal, unit)} w ostatnich {history.days} dniach.
        </p>
      )}
      {movements.length === 0 ? (
        <p className="m-0 py-3 text-sm font-semibold text-[#5f5a58]">Brak przyjęć i korekt w tym okresie.</p>
      ) : (
        <ol className="m-0 p-0 list-none flex flex-col">
          {movements.map((movement) => {
            const Icon = MOVEMENT_ICONS[movement.kind];
            const quantity = Number(movement.quantity);
            return (
              <li key={movement.movement_id} className="flex items-center gap-3 py-2.5 border-t border-[#e6e1df] first:border-t-0">
                <span
                  aria-hidden
                  className={`shrink-0 grid place-items-center size-8 rounded-[10px] ${
                    quantity >= 0 ? 'bg-[#e3eefc] text-[#1d5fb0]' : 'bg-[#fdecec] text-[#a32a2a]'
                  }`}
                >
                  <Icon className="size-4" />
                </span>
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="text-[13px] font-bold truncate">{MOVEMENT_LABELS[movement.kind]}</span>
                  <span className="text-xs font-semibold text-[#5f5a58] truncate">
                    {formatDate(movement.created_at)} {formatClock(movement.created_at)}
                    {movement.created_by_name && ` · ${movement.created_by_name}`}
                    {movement.note && ` · ${movement.note}`}
                  </span>
                </span>
                <span className="shrink-0 text-right flex flex-col">
                  <span className="text-[13px] font-extrabold tabular-nums">
                    {quantity > 0 ? '+' : quantity < 0 ? '−' : ''}
                    {formatQty(Math.abs(quantity), unit)}
                  </span>
                  <span className="text-[11px] font-semibold text-[#5f5a58] tabular-nums">
                    stan {formatQty(Number(movement.balance_after))}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function StockDetail({
  item,
  items,
  history,
  loading,
  error,
  period,
  onPeriod,
  onSelect,
  onAdjust,
}: {
  item: StockItem;
  items: StockItem[];
  history: StockHistory | null;
  loading: boolean;
  error: string | null;
  period: Period;
  onPeriod: (period: Period) => void;
  onSelect: (id: number) => void;
  onAdjust: () => void;
}) {
  return (
    <section
      aria-labelledby="detail-title"
      className="flex flex-col gap-5 p-4 sm:p-6 rounded-[18px] bg-bakery-card border border-bakery-btnBorder"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex flex-col gap-1">
          <label htmlFor="detail-ingredient" className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]">
            Historia stanu
          </label>
          <div className="relative">
            <select
              id="detail-ingredient"
              value={item.ingredient_id}
              onChange={(event) => onSelect(Number(event.target.value))}
              className="max-w-full field-sizing-content appearance-none pr-8 bg-transparent border-0 p-0 font-display text-[26px] sm:text-[30px] leading-tight font-extrabold text-bakery-dark cursor-pointer outline-none focus-visible:underline"
            >
              {items.map((option) => (
                <option key={option.ingredient_id} value={option.ingredient_id}>
                  {option.name}
                </option>
              ))}
            </select>
            <span aria-hidden className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-lg font-extrabold">▾</span>
          </div>
          <h2 id="detail-title" className="sr-only">Historia stanu: {item.name}</h2>
          <span className="inline-flex items-center gap-2 text-[13px] font-bold text-[#3d3937]">
            <span aria-hidden className="size-2 rounded-full" style={{ background: STATUS_COLORS[item.status] }} />
            {STATUS_LABELS[item.status]}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Okres" className="inline-flex p-1 rounded-xl bg-[#ece7e5]">
            {PERIODS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={period === value}
                onClick={() => onPeriod(value)}
                className={`h-9 px-3.5 rounded-[9px] border-0 text-[13px] font-extrabold cursor-pointer transition ${
                  period === value ? 'bg-white text-bakery-dark shadow-sm' : 'bg-transparent text-[#5f5a58] hover:text-bakery-dark'
                }`}
              >
                {value} dni
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onAdjust}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border-0 bg-bakery-dark text-white text-sm font-extrabold cursor-pointer transition hover:bg-[#2e2e2e]"
          >
            <SlidersHorizontal aria-hidden className="size-4" />
            Zmień stan
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <Stat
          label="Na stanie"
          value={formatQty(item.current, item.unit)}
          hint={`minimum ${formatQty(item.minimum, item.unit)} – zużycie z 7 dni`}
        />
        <Stat label="Zużycie dziennie" value={formatQty(item.usage, item.unit)} hint="średnia z ostatnich 7 dni" />
        <Stat label="Wystarczy na" value={formatDays(item.days_left)} hint="przy obecnym zużyciu" />
        <Stat label="Ostatnia dostawa" value={formatDate(item.last_delivery_at)} hint={item.last_delivery_at ? undefined : 'brak w historii'} />
      </div>

      {error ? (
        <p role="alert" className="m-0 px-4 py-3 rounded-xl bg-[#fdecec] text-[#8f1616] text-sm font-bold">{error}</p>
      ) : (
        <div className="flex flex-wrap gap-6">
          <div className="flex-[3_1_480px] min-w-0">
            <StockChart
              series={history?.series ?? []}
              minimum={item.minimum}
              unit={item.unit}
              name={item.name}
              loading={loading}
            />
          </div>
          <Movements history={history} unit={item.unit} />
        </div>
      )}
    </section>
  );
}
