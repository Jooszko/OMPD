import { PackagePlus, Plus } from 'lucide-react';
import { DayRing, type RingPart } from '../../home/components/DayRing';
import { formatHeroDate } from '../../home/lib/home';
import {
  byUrgency,
  formatDays,
  formatQty,
  headline,
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_ORDER,
  statusCounts,
  stockBar,
  summary,
  type StockItem,
  type StockStatus,
} from '../lib/warehouse';

const STATUS_PARTS: RingPart<StockStatus>[] = STATUS_ORDER.map((status) => ({
  key: status,
  label: STATUS_LABELS[status],
  color: STATUS_COLORS[status],
}));

function ReorderCard({ items, onSelect }: { items: StockItem[]; onSelect: (id: number) => void }) {
  const urgent = items.filter((item) => item.status !== 'good').sort(byUrgency).slice(0, 4);
  return (
    <div className="relative flex-[1_1_260px] flex flex-col gap-3 px-5 py-[18px] rounded-[18px] bg-[#262221]">
      <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#bdb5b2]">Do zamówienia najpierw</span>
      {urgent.length === 0 ? (
        <span className="text-sm font-semibold text-[#bdb5b2]">Wszystkie surowce mają zapas powyżej 150% minimum.</span>
      ) : (
        <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
          {urgent.map((item) => {
            const { fill } = stockBar(item);
            return (
              <li key={item.ingredient_id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.ingredient_id)}
                  className="w-full flex flex-col gap-1.5 p-0 bg-transparent border-0 text-left text-white cursor-pointer group"
                >
                  <span className="w-full flex justify-between gap-3 text-sm font-bold">
                    <span className="truncate group-hover:underline">{item.name}</span>
                    <span className="shrink-0 font-extrabold tabular-nums">{formatDays(item.days_left)}</span>
                  </span>
                  <span aria-hidden className="relative h-1.5 w-full rounded-full bg-[#3a3533] overflow-hidden">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${fill * 100}%`, background: STATUS_COLORS[item.status] }}
                    />
                  </span>
                  <span className="text-xs font-semibold text-[#bdb5b2] tabular-nums">
                    {formatQty(item.current, item.unit)} z minimum {formatQty(item.minimum, item.unit)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function WarehouseHero({
  items,
  canManage,
  onReceive,
  onCreate,
  onSelect,
}: {
  items: StockItem[];
  canManage: boolean;
  onReceive: () => void;
  onCreate: () => void;
  onSelect: (id: number) => void;
}) {
  const counts = statusCounts(items);

  return (
    <section
      aria-label="Podsumowanie magazynu"
      className="relative overflow-hidden rounded-[24px] bg-bakery-dark text-white px-5 py-6 sm:px-9 sm:py-8 flex flex-wrap items-center gap-x-12 gap-y-7"
    >
      <div aria-hidden className="absolute -right-[120px] -top-[160px] size-[420px] rounded-full border-[56px] border-[#262221]" />

      <div className="relative flex-[999_1_420px] min-w-0 flex flex-col gap-[18px]">
        <div className="flex flex-col gap-2">
          <span className="text-xs sm:text-[13px] font-extrabold uppercase tracking-[0.1em] text-bakery-accent">
            Magazyn surowców · {formatHeroDate(new Date())}
          </span>
          <h1 className="m-0 font-display text-[34px] sm:text-[52px] leading-[0.95] font-extrabold tracking-[-0.03em]">
            {headline(items)}
          </h1>
          <p className="m-0 max-w-[560px] text-[15px] sm:text-[17px] leading-normal font-semibold text-[#d9d2cf]">
            {summary(items).map((segment, index) =>
              segment.strong ? (
                <strong key={index} className="text-white">{segment.text}</strong>
              ) : (
                <span key={index}>{segment.text}</span>
              )
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onReceive}
            disabled={items.length === 0}
            className="inline-flex items-center gap-2 min-h-11 px-[18px] rounded-xl border-0 bg-bakery-accent text-bakery-dark text-sm font-extrabold cursor-pointer transition hover:brightness-110 disabled:opacity-50"
          >
            <PackagePlus aria-hidden className="size-4" />
            Przyjmij dostawę
          </button>
          {canManage && (
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex items-center gap-2 min-h-11 px-[18px] rounded-xl border border-[#4a4442] bg-[#262221] text-white text-sm font-extrabold cursor-pointer transition hover:bg-[#2e2a29]"
            >
              <Plus aria-hidden className="size-4" />
              Nowy składnik
            </button>
          )}
        </div>
      </div>

      <DayRing counts={counts} parts={STATUS_PARTS} value={`${counts.good}/${items.length}`} caption="w normie" />

      <ReorderCard items={items} onSelect={onSelect} />
    </section>
  );
}
