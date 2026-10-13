import type { Change } from '../lib/money';
import { ChangeBadge } from './ChangeBadge';

export type KpiBalance = 'profit' | 'loss';

const CARD_CLASS: Record<KpiBalance | 'none', string> = {
  none: 'border bg-bakery-card border-bakery-btnBorder',
  profit: 'border-2 bg-[#cdebd5] border-[#3f8f56]',
  loss: 'border-2 bg-[#f8cccc] border-[#c62828]',
};

const BALANCE_LABEL: Record<KpiBalance, { text: string; className: string }> = {
  profit: { text: 'na plusie', className: 'bg-[#1f7a3a]' },
  loss: { text: 'strata', className: 'bg-[#b91c1c]' },
};

export function KpiCard({
  label,
  value,
  change,
  comparison,
  hint,
  balance,
}: {
  label: string;
  value: string;
  change: Change;
  comparison: string;
  hint?: string;
  balance?: KpiBalance;
}) {
  const mutedText = balance ? 'text-[#3d3937]' : 'text-[#5f5a58]';

  return (
    <div className={`rounded-[14px] shadow-sm px-5 py-[18px] flex flex-col gap-2.5 min-w-0 ${CARD_CLASS[balance ?? 'none']}`}>
      <span
        className={`flex items-center justify-between gap-2 text-[11px] font-extrabold uppercase tracking-[0.08em] ${mutedText}`}
      >
        {label}
        {balance && (
          <span className={`px-2 py-0.5 rounded-full text-white tracking-[0.06em] ${BALANCE_LABEL[balance].className}`}>
            {BALANCE_LABEL[balance].text}
          </span>
        )}
      </span>
      <span className="font-display text-[30px] leading-none font-extrabold tabular-nums">{value}</span>
      <div className="flex flex-wrap items-center gap-2">
        <ChangeBadge change={change} onTint={Boolean(balance)} />
        <span className={`text-xs font-semibold ${mutedText}`}>{comparison}</span>
      </div>
      {hint && <span className="text-xs font-semibold text-[#3d3937] tabular-nums">{hint}</span>}
    </div>
  );
}