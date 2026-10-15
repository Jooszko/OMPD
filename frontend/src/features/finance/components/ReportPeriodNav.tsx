import type { ReportPeriodKind } from '../../../services/api';
import { canGoForward, PERIOD_KIND_LABELS, shiftPeriod } from '../lib/reports';

const KINDS: ReportPeriodKind[] = ['month', 'quarter', 'year'];
const ARROW =
  'w-11 h-11 inline-flex items-center justify-center rounded-xl border border-bakery-btnBorder bg-bakery-card text-bakery-dark disabled:opacity-40';

export function ReportPeriodNav({
  kind,
  anchor,
  today,
  label,
  onKindChange,
  onAnchorChange,
}: {
  kind: ReportPeriodKind;
  anchor: string;
  today: string;
  label: string | null;
  onKindChange: (kind: ReportPeriodKind) => void;
  onAnchorChange: (anchor: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="group" aria-label="Rodzaj okresu" className="flex gap-0.5 p-[3px] bg-bakery-card border border-bakery-btnBorder rounded-xl">
        {KINDS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={kind === option}
            onClick={() => onKindChange(option)}
            className={`h-9 px-4 rounded-[9px] text-[13px] font-extrabold ${
              kind === option ? 'bg-bakery-dark text-white' : 'text-[#3d3937] hover:bg-bakery-rowBg'
            }`}
          >
            {PERIOD_KIND_LABELS[option]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Poprzedni okres" onClick={() => onAnchorChange(shiftPeriod(kind, anchor, -1))} className={ARROW}>
          ‹
        </button>
        <h2 className="m-0 min-w-[200px] text-center font-display text-2xl font-extrabold">
          {label ? label.charAt(0).toUpperCase() + label.slice(1) : '…'}
        </h2>
        <button
          type="button"
          aria-label="Następny okres"
          disabled={!canGoForward(kind, anchor, today)}
          onClick={() => onAnchorChange(shiftPeriod(kind, anchor, 1))}
          className={ARROW}
        >
          ›
        </button>
      </div>
    </div>
  );
}