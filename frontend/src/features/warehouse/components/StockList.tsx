import { AlertTriangle, Check, CheckCircle2, ChevronDown, Pencil, Search, SlidersHorizontal, XCircle } from 'lucide-react';
import { Select } from '@base-ui/react/select';
import { type ComponentType, type CSSProperties, useMemo, useState } from 'react';
import {
  BAR_MIN_POSITION,
  byUrgency,
  formatDays,
  formatQty,
  STATUS_COLORS,
  STATUS_LABELS,
  statusCounts,
  stockBar,
  type StockItem,
  type StockStatus,
} from '../lib/warehouse';

type Filter = 'all' | 'attention';
type Sort = 'urgency' | 'name';

const STATUS_ICONS: Record<StockStatus, ComponentType<{ className?: string; style?: CSSProperties }>> = {
  critical: XCircle,
  warning: AlertTriangle,
  good: CheckCircle2,
};

const CHIP = 'h-9 px-3.5 rounded-full border text-[13px] font-extrabold cursor-pointer transition';

function StatusBadge({ status }: { status: StockStatus }) {
  const Icon = STATUS_ICONS[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#3d3937] whitespace-nowrap">
      <Icon aria-hidden className="size-4" style={{ color: STATUS_COLORS[status] }} />
      {STATUS_LABELS[status]}
    </span>
  );
}

function StockBar({ item }: { item: StockItem }) {
  const { fill, overflow } = stockBar(item);
  return (
    <span aria-hidden className="relative block h-2 w-full rounded-full bg-[#ece7e5]">
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${fill * 100}%`, background: STATUS_COLORS[item.status] }}
      />
      {item.minimum > 0 && (
        <span
          className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-bakery-dark"
          style={{ left: `${BAR_MIN_POSITION * 100}%` }}
        />
      )}
      {overflow && <span className="absolute -right-0.5 -top-[5px] text-[11px] font-black text-bakery-dark">›</span>}
    </span>
  );
}

export function StockList({
  items,
  selectedId,
  canManage,
  onSelect,
  onAdjust,
  onEdit,
}: {
  items: StockItem[];
  selectedId: number | null;
  canManage: boolean;
  onSelect: (id: number) => void;
  onAdjust: (item: StockItem) => void;
  onEdit: (item: StockItem) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('urgency');
  const counts = statusCounts(items);
  const attention = counts.critical + counts.warning;

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('pl');
    return items
      .filter((item) => filter === 'all' || item.status !== 'good')
      .filter((item) => !needle || item.name.toLocaleLowerCase('pl').includes(needle))
      .sort(sort === 'urgency' ? byUrgency : (a, b) => a.name.localeCompare(b.name, 'pl'));
  }, [items, query, filter, sort]);

  return (
    <section aria-labelledby="stock-list-title" className="rounded-[18px] bg-bakery-card border border-bakery-btnBorder overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 pt-5 pb-4">
        <div className="flex flex-col gap-0.5">
          <h2 id="stock-list-title" className="m-0 text-lg font-extrabold">Wszystkie surowce</h2>
          <span className="text-xs font-semibold text-[#5f5a58]">
            Czarna kreska to minimum – tyle, ile produkcja zużyła w ostatnich 7 dniach. Kliknij surowiec, żeby zobaczyć jego historię.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Szukaj surowca</span>
            <Search aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#8a8381]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Szukaj surowca"
              className="h-9 w-[180px] pl-9 pr-3 rounded-full border border-bakery-btnBorder bg-white text-[13px] font-semibold outline-none focus:border-bakery-accent"
            />
          </label>
          <button
            type="button"
            aria-pressed={filter === 'all'}
            onClick={() => setFilter('all')}
            className={`${CHIP} ${filter === 'all' ? 'bg-bakery-dark border-bakery-dark text-white' : 'bg-white border-bakery-btnBorder text-bakery-dark'}`}
          >
            Wszystkie {items.length}
          </button>
          <button
            type="button"
            aria-pressed={filter === 'attention'}
            onClick={() => setFilter('attention')}
            className={`${CHIP} ${filter === 'attention' ? 'bg-bakery-dark border-bakery-dark text-white' : 'bg-white border-bakery-btnBorder text-bakery-dark'}`}
          >
            Do uzupełnienia {attention}
          </button>
          <Select.Root
            value={sort}
            onValueChange={(value) => {
              if (value === 'urgency' || value === 'name') setSort(value);
            }}
          >
            <Select.Trigger
              aria-label="Sortowanie"
              className="inline-flex h-9 items-center gap-2 rounded-full border border-bakery-btnBorder bg-white px-3.5 text-[13px] font-extrabold text-bakery-dark outline-none transition hover:bg-[#fff4e2] focus-visible:border-bakery-accent cursor-pointer"
            >
              <Select.Value>{sort === 'urgency' ? 'Najpilniejsze' : 'Alfabetycznie'}</Select.Value>
              <Select.Icon>
                <ChevronDown aria-hidden className="size-4 text-[#5f5a58]" />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner align="end" sideOffset={5} className="z-50">
                <Select.Popup className="sidebar-nav-scrollbar max-h-[min(12rem,var(--available-height))] min-w-[var(--anchor-width)] overflow-y-auto rounded-xl border border-bakery-btnBorder bg-white p-1.5 shadow-xl outline-none">
                  <Select.List>
                    <Select.Item
                      value="urgency"
                      className="flex cursor-pointer items-center justify-between gap-4 rounded-lg px-3 py-2 text-[13px] font-semibold text-bakery-dark outline-none data-[highlighted]:bg-[#f6f2f0] data-[selected]:bg-[#fff4e2] data-[selected]:font-extrabold"
                    >
                      <Select.ItemText>Najpilniejsze</Select.ItemText>
                      <Select.ItemIndicator><Check aria-hidden className="size-4 text-bakery-accent" /></Select.ItemIndicator>
                    </Select.Item>
                    <Select.Item
                      value="name"
                      className="flex cursor-pointer items-center justify-between gap-4 rounded-lg px-3 py-2 text-[13px] font-semibold text-bakery-dark outline-none data-[highlighted]:bg-[#f6f2f0] data-[selected]:bg-[#fff4e2] data-[selected]:font-extrabold"
                    >
                      <Select.ItemText>Alfabetycznie</Select.ItemText>
                      <Select.ItemIndicator><Check aria-hidden className="size-4 text-bakery-accent" /></Select.ItemIndicator>
                    </Select.Item>
                  </Select.List>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </div>
      </div>

      <div
        aria-hidden
        className="hidden md:grid grid-cols-[minmax(160px,1.4fr)_minmax(160px,1.6fr)_120px_130px_auto] gap-4 px-6 py-2 border-t border-[#e6e1df] text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]"
      >
        <span>Surowiec</span>
        <span>Stan / minimum</span>
        <span>Wystarczy na</span>
        <span>Status</span>
        <span className="w-[84px]" />
      </div>

      {visible.length === 0 ? (
        <p className="m-0 px-6 py-8 border-t border-[#e6e1df] text-center text-sm font-semibold text-[#5f5a58]">
          {items.length === 0 ? 'Nie ma jeszcze żadnych surowców.' : 'Żaden surowiec nie pasuje do filtra.'}
        </p>
      ) : (
        <ul className="m-0 p-0 list-none">
          {visible.map((item) => {
            const selected = item.ingredient_id === selectedId;
            return (
              <li
                key={item.ingredient_id}
                className={`relative grid grid-cols-[1fr_auto] md:grid-cols-[minmax(160px,1.4fr)_minmax(160px,1.6fr)_120px_130px_auto] items-center gap-x-4 gap-y-2 px-4 sm:px-6 py-3 border-t border-[#e6e1df] transition-colors ${
                  selected ? 'bg-[#fff4e2]' : 'hover:bg-white'
                }`}
              >
                {selected && <span aria-hidden className="absolute left-0 inset-y-0 w-1 bg-bakery-accent" />}
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(item.ingredient_id)}
                  className="min-w-0 flex flex-col items-start p-0 bg-transparent border-0 text-left cursor-pointer text-bakery-dark after:absolute after:inset-0 after:content-['']"
                >
                  <span className="max-w-full text-[15px] font-extrabold truncate">{item.name}</span>
                  <span className="text-xs font-semibold text-[#5f5a58]">
                    zużycie {formatQty(item.usage, item.unit)}/dzień
                  </span>
                </button>

                <div className="col-span-2 md:col-span-1 row-start-2 md:row-start-auto flex flex-col gap-1.5 min-w-0">
                  <StockBar item={item} />
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold tabular-nums text-[#3d3937]">
                      <span className="text-bakery-dark font-extrabold">{formatQty(item.current, item.unit)}</span>
                      {' '}/ {formatQty(item.minimum, item.unit)}
                    </span>
                    <span className="md:hidden">
                      <StatusBadge status={item.status} />
                    </span>
                  </span>
                </div>

                <span className="hidden md:block text-sm font-extrabold tabular-nums">{formatDays(item.days_left)}</span>

                <span className="hidden md:block">
                  <StatusBadge status={item.status} />
                </span>

                <div className="relative z-[1] row-start-1 col-start-2 md:row-start-auto md:col-start-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onAdjust(item)}
                    aria-label={`Zmień stan: ${item.name}`}
                    title="Zmień stan"
                    className="grid place-items-center size-10 rounded-xl border border-bakery-btnBorder bg-white text-bakery-dark cursor-pointer transition hover:border-bakery-dark"
                  >
                    <SlidersHorizontal aria-hidden className="size-4" />
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      aria-label={`Edytuj: ${item.name}`}
                      title="Edytuj składnik"
                      className="grid place-items-center size-10 rounded-xl border border-bakery-btnBorder bg-white text-bakery-dark cursor-pointer transition hover:border-bakery-dark"
                    >
                      <Pencil aria-hidden className="size-4" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
