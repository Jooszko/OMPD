export interface BarItem {
  key: string | number;
  label: string;
  value: number;
}

export function HorizontalBarList({
  items,
  color,
  emptyText,
}: {
  items: BarItem[];
  color: string;
  emptyText: string;
}) {
  if (items.length === 0) {
    return <p className="m-0 text-[13px] font-semibold text-[#5f5a58]">{emptyText}</p>;
  }

  const max = Math.max(...items.map((item) => item.value));

  return (
    <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item.key} className="flex flex-col gap-1">
          <span className="text-[13px] font-bold">{item.label}</span>
          <span className="flex items-center gap-2">
            <span className="flex-1">
              <span
                className="block h-3 rounded-full"
                style={{ width: `${(item.value / max) * 100}%`, minWidth: 4, background: color }}
                aria-hidden
              />
            </span>
            <span className="w-8 text-right text-[13px] font-extrabold tabular-nums">{item.value}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}