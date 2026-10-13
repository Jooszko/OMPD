import { categoryColors } from '../lib/categories';
import { countLabel, type CategorySummary } from '../lib/expenses';
import { formatMoney, formatShare } from '../lib/money';

function CategoryCard({
  label,
  total,
  count,
  share,
  color,
  active,
  onClick,
}: {
  label: string;
  total: number;
  count: number;
  share: string | null;
  color: string | null;
  active: boolean;
  onClick: () => void;
}) {
  const sharePct = share && share !== '—' ? share : '0%';
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`text-left px-4 py-3.5 rounded-[14px] border shadow-sm flex flex-col gap-2 transition ${
        active
          ? 'bg-bakery-dark border-bakery-dark text-white'
          : 'bg-bakery-card border-bakery-btnBorder text-bakery-dark hover:border-[#8f8a88]'
      }`}
    >
      <span className="flex items-center gap-2 text-[13px] font-extrabold">
        {color && <span aria-hidden className="w-3 h-3 rounded" style={{ background: color }} />}
        {label}
      </span>
      <span className="text-xl font-extrabold tabular-nums">{formatMoney(total)}</span>
      <span className={`text-xs font-bold tabular-nums ${active ? 'text-[#cfc8c4]' : 'text-[#5f5a58]'}`}>
        {countLabel(count)}
        {share !== null && ` · ${sharePct}`}
      </span>
      <span aria-hidden className={`h-[5px] rounded-full ${active ? 'bg-[#3a3533]' : 'bg-bakery-rowBg'}`}>
        <span
          className="block h-full rounded-full"
          style={{ width: share === null ? '100%' : sharePct, background: color ?? '#f49f1c' }}
        />
      </span>
    </button>
  );
}

export function CategoryCards({
  summary,
  selected,
  onSelect,
}: {
  summary: CategorySummary[];
  selected: string | null;
  onSelect: (category: string | null) => void;
}) {
  const total = summary.reduce((sum, item) => sum + item.total, 0);
  const count = summary.reduce((sum, item) => sum + item.count, 0);

  return (
    <div role="group" aria-label="Kategorie wydatków" className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2.5">
      <CategoryCard
        label="Wszystkie"
        total={total}
        count={count}
        share={null}
        color={null}
        active={selected === null}
        onClick={() => onSelect(null)}
      />
      {summary.map((item) => (
        <CategoryCard
          key={item.value}
          label={item.label}
          total={item.total}
          count={item.count}
          share={formatShare(item.total, total)}
          color={categoryColors(item.value).color}
          active={selected === item.value}
          onClick={() => onSelect(selected === item.value ? null : item.value)}
        />
      ))}
    </div>
  );
}