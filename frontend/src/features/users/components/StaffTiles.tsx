import type { StaffFilter } from '../lib/staff';

const TILES: { key: StaffFilter; label: string; hint: (counts: Record<StaffFilter, number>) => string; color: string }[] = [
  { key: 'all', label: 'Wszyscy', hint: (c) => `${c.all - c.blocked} z dostępem`, color: 'text-bakery-dark' },
  { key: 'admin', label: 'Kierownicy', hint: () => 'pełny dostęp', color: 'text-[#1d4f91]' },
  { key: 'baker', label: 'Piekarze', hint: () => 'produkcja i zamówienia', color: 'text-[#7a4300]' },
  { key: 'driver', label: 'Kierowcy', hint: () => 'trasy i dostawy', color: 'text-[#17604c]' },
  { key: 'blocked', label: 'Zablokowani', hint: () => 'nie mogą się zalogować', color: 'text-[#b91c1c]' },
  { key: 'pending', label: 'Czekają', hint: () => 'na pierwsze logowanie', color: 'text-[#9a5b00]' },
];

export function StaffTiles({
  counts,
  value,
  onChange,
}: {
  counts: Record<StaffFilter, number>;
  value: StaffFilter;
  onChange: (filter: StaffFilter) => void;
}) {
  const pick = (key: StaffFilter) => onChange(value === key && key !== 'all' ? 'all' : key);

  return (
    <div role="group" aria-label="Filtr kont">
      <div className="sm:hidden -mx-4 px-4 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TILES.map((tile) => (
          <button
            key={tile.key}
            type="button"
            aria-pressed={value === tile.key}
            onClick={() => pick(tile.key)}
            className={`shrink-0 min-h-10 px-3.5 rounded-full border text-[13px] font-extrabold whitespace-nowrap ${
              value === tile.key
                ? 'bg-bakery-dark border-bakery-dark text-white'
                : 'bg-bakery-card border-bakery-btnBorder text-bakery-dark'
            }`}
          >
            {tile.label} {counts[tile.key]}
          </button>
        ))}
      </div>

      <div className="hidden sm:grid grid-cols-3 xl:grid-cols-6 gap-3">
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
              <span className={`text-xs font-bold ${active ? 'text-[#d9d2cf]' : 'text-[#5f5a58]'}`}>{tile.hint(counts)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}