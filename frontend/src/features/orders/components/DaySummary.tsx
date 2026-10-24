import type { OrderDay } from '../../../services/api';
import { STATUS_META, formatMoney, formatPieces, statusSegments, type StatusFilter } from '../lib/orders';

export function DaySummary({
  summary,
  status,
  onStatusChange,
}: {
  summary: OrderDay['summary'];
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
}) {
  const delivered = summary.by_status.delivered;
  const tiles = [
    { label: 'Klienci', value: String(summary.stops), hint: 'punkty dostaw' },
    { label: 'Sztuki', value: formatPieces(summary.pieces), hint: 'do dostarczenia' },
    { label: 'Wartość', value: formatMoney(summary.value), hint: 'bez anulowanych' },
    { label: 'Dostarczone', value: `${delivered}/${summary.stops}`, hint: 'przystanków' },
  ];
  const segments = statusSegments(summary.by_status);

  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="px-4 py-3.5 rounded-[14px] border border-bakery-btnBorder bg-bakery-card shadow-sm flex flex-col gap-1.5"
          >
            <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]">{tile.label}</span>
            <span className="font-display text-[26px] leading-none font-extrabold tabular-nums">{tile.value}</span>
            <span className="text-xs font-bold text-[#5f5a58]">{tile.hint}</span>
          </div>
        ))}
      </div>

      {segments.length > 0 && (
        <div className="flex flex-col gap-2.5 px-4 py-3.5 rounded-[14px] border border-bakery-btnBorder bg-bakery-card shadow-sm">
          <div aria-hidden className="flex h-2.5 rounded-full overflow-hidden gap-[2px] bg-[#e6e1df]">
            {segments.map((segment) => (
              <span
                key={segment.status}
                className={STATUS_META[segment.status].dot}
                style={{ width: `${segment.share * 100}%` }}
              />
            ))}
          </div>
          <div role="group" aria-label="Filtr statusu" className="flex flex-wrap gap-2">
            {segments.map((segment) => {
              const active = status === segment.status;
              return (
                <button
                  key={segment.status}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onStatusChange(active ? 'all' : segment.status)}
                  className={`inline-flex items-center gap-2 min-h-9 px-3 rounded-full border text-[13px] font-extrabold ${
                    active ? 'bg-bakery-dark border-bakery-dark text-white' : 'bg-white border-bakery-btnBorder text-bakery-dark'
                  }`}
                >
                  <span aria-hidden className={`size-2.5 rounded-full ${STATUS_META[segment.status].dot}`} />
                  {STATUS_META[segment.status].label}
                  <span className="tabular-nums">{segment.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}