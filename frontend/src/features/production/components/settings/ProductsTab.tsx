import { AlertTriangle, Flame, Pencil, Search, Unlink } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ProductBakeSpecRow, ProductionSettings } from '../../../../services/api';
import { plural } from '../../../home/lib/home';
import { categoryLabel, groupByDough, productMatches } from '../../lib/productionSettings';
import { formatAmount } from '../../lib/productionStage';
import { ICON_BUTTON, ICON_DANGER } from './styles';

const ROW_GRID = 'md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_100px_150px_92px]';

function MissingProducts({
  rows,
  canEdit,
  onAssign,
}: {
  rows: ProductBakeSpecRow[];
  canEdit: boolean;
  onAssign: (row: ProductBakeSpecRow) => void;
}) {
  return (
    <section
      aria-labelledby="missing-title"
      className="flex flex-col gap-4 p-4 sm:p-6 rounded-[18px] bg-[#fff8eb] border border-[#f3d9a4]"
    >
      <div className="flex items-start gap-3 text-[#6b4300]">
        <AlertTriangle aria-hidden className="size-5 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-0.5">
          <h2 id="missing-title" className="m-0 text-lg font-extrabold">
            Do uzupełnienia: {rows.length} {plural(rows.length, 'wyrób', 'wyroby', 'wyrobów')}
          </h2>
          <p className="m-0 text-[13px] font-semibold">
            Planowanie pomija te wyroby, dopóki nie dostaną ciasta, wagi kęsa i parametrów wypieku.
          </p>
        </div>
      </div>
      <ul className="m-0 p-0 list-none grid grid-cols-[repeat(auto-fill,minmax(min(100%,250px),1fr))] gap-2.5">
        {rows.map((row) => (
          <li
            key={row.product_id}
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-[14px] bg-white border border-[#f3d9a4]"
          >
            <span className="min-w-0 flex flex-col">
              <span className="text-[15px] font-extrabold leading-tight break-words">{row.product_name}</span>
              <span className="text-xs font-semibold text-[#5f5a58]">{categoryLabel(row.category)}</span>
            </span>
            {canEdit && (
              <button
                type="button"
                onClick={() => onAssign(row)}
                aria-label={`Przypisz ciasto: ${row.product_name}`}
                className="shrink-0 h-9 px-3.5 rounded-full border-0 bg-bakery-dark text-white text-[13px] font-extrabold cursor-pointer transition hover:bg-[#2e2e2e]"
              >
                Przypisz
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProductRow({
  row,
  canEdit,
  onEdit,
  onUnlink,
}: {
  row: ProductBakeSpecRow;
  canEdit: boolean;
  onEdit: (row: ProductBakeSpecRow) => void;
  onUnlink: (row: ProductBakeSpecRow) => void;
}) {
  const spec = row.spec!;
  return (
    <li
      className={`grid grid-cols-[1fr_auto] ${ROW_GRID} items-center gap-x-4 gap-y-1.5 px-4 sm:px-6 py-3 border-t border-[#e6e1df] hover:bg-white transition-colors`}
    >
      <span className="min-w-0 flex flex-col">
        <span className="text-[15px] font-extrabold truncate">{row.product_name}</span>
        <span className="md:hidden text-xs font-semibold text-[#5f5a58]">{categoryLabel(row.category)}</span>
      </span>
      <span className="hidden md:block text-[13px] font-semibold text-[#5f5a58] truncate">{categoryLabel(row.category)}</span>
      <span className="col-span-2 md:col-span-1 row-start-2 md:row-start-auto flex flex-wrap items-center gap-x-4 gap-y-1 md:contents">
        <span className="text-sm font-extrabold tabular-nums">
          <span className="md:hidden text-xs font-semibold text-[#5f5a58]">kęs </span>
          {formatAmount(Number(spec.piece_weight_kg), 'kg')}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#3d3937] tabular-nums">
          <Flame aria-hidden className="size-3.5 text-bakery-accent" />
          {spec.bake_temp_c} °C · {spec.bake_time_min} min
        </span>
      </span>
      <span className="row-start-1 col-start-2 md:row-start-auto md:col-start-auto flex justify-end gap-1.5">
        {canEdit && (
          <>
            <button
              type="button"
              onClick={() => onEdit(row)}
              aria-label={`Edytuj parametry: ${row.product_name}`}
              title="Edytuj parametry"
              className={ICON_BUTTON}
            >
              <Pencil aria-hidden className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onUnlink(row)}
              aria-label={`Odłącz od produkcji: ${row.product_name}`}
              title="Odłącz od produkcji"
              className={ICON_DANGER}
            >
              <Unlink aria-hidden className="size-4" />
            </button>
          </>
        )}
      </span>
    </li>
  );
}

export function ProductsTab({
  settings,
  canEdit,
  onAssign,
  onUnlink,
}: {
  settings: ProductionSettings;
  canEdit: boolean;
  onAssign: (row: ProductBakeSpecRow) => void;
  onUnlink: (row: ProductBakeSpecRow) => void;
}) {
  const [query, setQuery] = useState('');
  const [doughFilter, setDoughFilter] = useState<number | 'all'>('all');

  const missing = settings.products.filter((row) => !row.spec);
  const assigned = settings.products.length - missing.length;
  const visibleMissing = missing.filter((row) => productMatches(row, query));
  const groups = useMemo(
    () =>
      groupByDough(
        settings.products.filter((row) => productMatches(row, query)),
        settings.doughs.filter((dough) => doughFilter === 'all' || dough.dough_id === doughFilter)
      ),
    [settings, query, doughFilter]
  );

  return (
    <div className="flex flex-col gap-5">
      {visibleMissing.length > 0 && doughFilter === 'all' && (
        <MissingProducts rows={visibleMissing} canEdit={canEdit} onAssign={onAssign} />
      )}

      <section aria-labelledby="products-title" className="rounded-[18px] bg-bakery-card border border-bakery-btnBorder overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 pt-5 pb-4">
          <div className="flex flex-col gap-0.5">
            <h2 id="products-title" className="m-0 text-lg font-extrabold">
              Wyroby w planowaniu
            </h2>
            <span className="text-xs font-semibold text-[#5f5a58]">
              {assigned} z {settings.products.length} {plural(settings.products.length, 'wyrobu', 'wyrobów', 'wyrobów')} ma
              ciasto i wagę kęsa. Kęs to surowe ciasto przed wypiekiem.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <span className="sr-only">Szukaj wyrobu</span>
              <Search aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#8a8381]" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Szukaj wyrobu"
                className="h-9 w-[180px] pl-9 pr-3 rounded-full border border-bakery-btnBorder bg-white text-[13px] font-semibold outline-none focus:border-bakery-accent"
              />
            </label>
            <label>
              <span className="sr-only">Ciasto</span>
              <select
                value={doughFilter}
                onChange={(event) => setDoughFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))}
                className="h-9 px-3 rounded-full border border-bakery-btnBorder bg-white text-[13px] font-extrabold outline-none focus:border-bakery-accent cursor-pointer"
              >
                <option value="all">Wszystkie ciasta</option>
                {settings.doughs.map((dough) => (
                  <option key={dough.dough_id} value={dough.dough_id}>
                    {dough.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div
          aria-hidden
          className={`hidden md:grid ${ROW_GRID} gap-4 px-6 py-2 border-t border-[#e6e1df] text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]`}
        >
          <span>Wyrób</span>
          <span>Kategoria</span>
          <span>Kęs</span>
          <span>Wypiek</span>
          <span />
        </div>

        {groups.length === 0 ? (
          <p className="m-0 px-6 py-8 border-t border-[#e6e1df] text-center text-sm font-semibold text-[#5f5a58]">
            {assigned === 0 ? 'Żaden wyrób nie ma jeszcze parametrów produkcji.' : 'Żaden wyrób nie pasuje do wyszukiwania.'}
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.dough_id}>
              <h3 className="m-0 flex items-baseline gap-2 px-4 sm:px-6 py-2.5 border-t border-[#e6e1df] bg-[#ece7e5] text-sm font-extrabold">
                {group.name}
                <span className="text-xs font-semibold text-[#5f5a58]">
                  {group.rows.length} {plural(group.rows.length, 'wyrób', 'wyroby', 'wyrobów')}
                </span>
              </h3>
              <ul className="m-0 p-0 list-none">
                {group.rows.map((row) => (
                  <ProductRow key={row.product_id} row={row} canEdit={canEdit} onEdit={onAssign} onUnlink={onUnlink} />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
