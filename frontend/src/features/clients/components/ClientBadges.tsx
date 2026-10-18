import { formatDays, weekStrip } from '../lib/clients';

export function WeekStrip({ days, size = 'sm' }: { days: number[]; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'w-[22px] h-[22px] text-[10px] rounded-md' : 'flex-1 h-8 text-xs rounded-lg';
  return (
    <span role="img" aria-label={`Stałe zamówienia: ${formatDays(days)}`} className={`flex gap-[3px] ${size === 'md' ? 'w-full' : ''}`}>
      {weekStrip(days).map((day) => (
        <span
          key={day.label}
          aria-hidden
          className={`${box} flex items-center justify-center font-extrabold ${
            day.active ? 'bg-bakery-dark text-white' : 'bg-bakery-rowBg text-[#a19c9c]'
          }`}
        >
          {size === 'sm' ? day.letter : day.label}
        </span>
      ))}
    </span>
  );
}

export function ActiveBadge({ active, pill = false }: { active: boolean; pill?: boolean }) {
  if (!active) {
    return (
      <span className="inline-flex px-2.5 py-0.5 rounded-full bg-[#ebe7e7] text-[#4a4543] text-xs font-extrabold">
        Nieaktywny
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${
        pill
          ? 'px-2.5 py-0.5 rounded-full bg-[#cdebd5] text-[#17532b] text-xs font-extrabold'
          : 'text-[13px] font-bold text-[#1f5f33]'
      }`}
    >
      <span aria-hidden className="w-2 h-2 rounded-full bg-[#1f7a3a]" />
      Aktywny
    </span>
  );
}

export function LocationBadge({ located }: { located: boolean }) {
  if (located) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#1f5f33]">
        <span aria-hidden className="w-2 h-2 rounded-full bg-[#1f7a3a]" />
        na mapie
      </span>
    );
  }
  return (
    <span className="inline-flex px-2.5 py-0.5 rounded-full bg-[#fbe5bd] text-[#7a4300] text-xs font-extrabold">
      brak lokalizacji
    </span>
  );
}