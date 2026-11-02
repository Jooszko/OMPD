import type { PlanPreviewDough } from '../../../../services/api';
import { MIXER_LOAD_COLORS, mixerLoad } from '../../lib/planning';

export function MixerBar({
  massKg,
  mixer,
  dark = false,
}: {
  massKg: number;
  mixer: PlanPreviewDough['mixer'];
  dark?: boolean;
}) {
  const load = mixerLoad(massKg, mixer);
  if (!load) return null;
  return (
    <span aria-hidden className={`relative block h-2 w-full rounded-full ${dark ? 'bg-[#3a3533]' : 'bg-[#ece7e5]'}`}>
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${Math.min(100, load.pct)}%`, background: MIXER_LOAD_COLORS[load.state] }}
      />
      {load.minPct > 0 && (
        <span
          className={`absolute -top-1 -bottom-1 w-0.5 rounded-full ${dark ? 'bg-white' : 'bg-bakery-dark'}`}
          style={{ left: `${load.minPct}%` }}
        />
      )}
    </span>
  );
}
