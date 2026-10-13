import type { Change } from '../lib/money';

const CHANGE_TEXT: Record<Change['tone'], string> = {
  good: 'text-[#14532d]',
  bad: 'text-[#991b1b]',
  neutral: 'text-[#3d3937]',
};

const CHANGE_BG: Record<Change['tone'], string> = {
  good: 'bg-[#dcefe2]',
  bad: 'bg-[#fbdcdc]',
  neutral: 'bg-bakery-rowBg',
};

export function ChangeBadge({ change, onTint = false }: { change: Change; onTint?: boolean }) {
  return (
    <span
      className={`px-2 py-[3px] rounded-full text-xs font-extrabold tabular-nums whitespace-nowrap ${
        onTint ? 'bg-white/85' : CHANGE_BG[change.tone]
      } ${CHANGE_TEXT[change.tone]}`}
    >
      {change.label}
    </span>
  );
}