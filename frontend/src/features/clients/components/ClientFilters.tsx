import type { ClientFilter, RouteGroup } from '../lib/clients';

const TILES: { key: ClientFilter; label: string; hint: string; color: string }[] = [
  { key: 'all', label: 'Wszyscy', hint: 'wszystkie punkty dostaw', color: 'text-bakery-dark' },
  { key: 'active', label: 'Aktywni', hint: 'dostają towar', color: 'text-[#1f5f33]' },
  { key: 'inactive', label: 'Nieaktywni', hint: 'wstrzymane dostawy', color: 'text-[#4a4543]' },
  { key: 'unlocated', label: 'Bez lokalizacji', hint: 'nie ma ich na mapie', color: 'text-[#9a5b00]' },
];

const CHIP = 'shrink-0 min-h-10 px-3.5 rounded-full border text-[13px] font-extrabold whitespace-nowrap';

export function ClientTiles({
  counts,
  value,
  onChange,
}: {
  counts: Record<ClientFilter, number>;
  value: ClientFilter;
  onChange: (filter: ClientFilter) => void;
}) {
  const pick = (key: ClientFilter) => onChange(value === key && key !== 'all' ? 'all' : key);

  return (
    <div role="group" aria-label="Filtr klientów">
      <div className="sm:hidden -mx-4 px-4 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TILES.map((tile) => (
          <button
            key={tile.key}
            type="button"
            aria-pressed={value === tile.key}
            onClick={() => pick(tile.key)}
            className={`${CHIP} ${
              value === tile.key
                ? 'bg-bakery-dark border-bakery-dark text-white'
                : 'bg-bakery-card border-bakery-btnBorder text-bakery-dark'
            }`}
          >
            {tile.label} {counts[tile.key]}
          </button>
        ))}
      </div>

      <div className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-3">
        {TILES.map((tile) => {
          const active = value === tile.key;
          return (
            <button
              key={tile.key}
              type="button"
              aria-pressed={active}
              onClick={() => pick(tile.key)}
              className={`text-left px-4 py-3.5 rounded-[14px] border shadow-sm flex flex-col gap-1.5 transition ${
                active
                  ? 'bg-bakery-dark border-bakery-dark text-white'
                  : 'bg-bakery-card border-bakery-btnBorder text-bakery-dark hover:border-[#8f8a88]'
              }`}
            >
              <span
                className={`text-[11px] font-extrabold uppercase tracking-[0.08em] ${active ? 'text-[#d9d2cf]' : 'text-[#5f5a58]'}`}
              >
                {tile.label}
              </span>
              <span className={`font-display text-[28px] leading-none font-extrabold tabular-nums ${active ? '' : tile.color}`}>
                {counts[tile.key]}
              </span>
              <span className={`text-xs font-bold ${active ? 'text-[#d9d2cf]' : 'text-[#5f5a58]'}`}>{tile.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function RouteFilter({
  routes,
  value,
  onChange,
}: {
  routes: Pick<RouteGroup, 'routeId' | 'name'>[];
  value: number | null;
  onChange: (routeId: number | null) => void;
}) {
  const options = [{ routeId: null, name: 'Wszystkie trasy' }, ...routes];
  return (
    <div
      role="group"
      aria-label="Trasa"
      className="-mx-4 px-4 sm:mx-0 sm:px-0 flex gap-2 overflow-x-auto sm:flex-wrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {options.map((option) => (
        <button
          key={option.routeId ?? 'all'}
          type="button"
          aria-pressed={value === option.routeId}
          onClick={() => onChange(option.routeId)}
          className={`${CHIP} ${
            value === option.routeId
              ? 'bg-bakery-dark border-bakery-dark text-white'
              : 'bg-bakery-card border-bakery-btnBorder text-bakery-dark hover:border-[#8f8a88]'
          }`}
        >
          {option.name}
        </button>
      ))}
    </div>
  );
}