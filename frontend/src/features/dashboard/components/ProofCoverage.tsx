import { Camera, PenLine, StickyNote } from 'lucide-react';
import type { DeliveryStats } from '../../../services/api';
import { formatPercent } from '../lib/statsFormat';

const KINDS = [
  { key: 'photo', label: 'Zdjęcie', icon: Camera },
  { key: 'signature', label: 'Podpis', icon: PenLine },
  { key: 'note', label: 'Notatka', icon: StickyNote },
] as const;

const METER_FILL = '#2e8b4e';
const METER_TRACK = '#dcefe0';

export function ProofCoverage({ coverage }: { coverage: DeliveryStats['proof_coverage'] }) {
  if (coverage.delivered_stops === 0) {
    return (
      <p className="m-0 text-[13px] font-semibold text-[#5f5a58]">Brak dostarczonych przystanków w tym okresie.</p>
    );
  }

  return (
    <ul className="m-0 p-0 list-none grid grid-cols-1 sm:grid-cols-3 gap-5">
      {KINDS.map(({ key, label, icon: Icon }) => {
        const count = coverage[key];
        const share = (count / coverage.delivered_stops) * 100;
        return (
          <li key={key} className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-[#4a4543]">
              <Icon className="w-4 h-4" aria-hidden />
              {label}
            </span>
            <span className="font-display text-[26px] leading-none font-extrabold">{formatPercent(share)}</span>
            <span className="h-1.5 rounded-full overflow-hidden" style={{ background: METER_TRACK }} aria-hidden>
              <span className="block h-full rounded-full" style={{ width: `${share}%`, background: METER_FILL }} />
            </span>
            <span className="text-xs font-bold text-[#5f5a58]">
              {count} z {coverage.delivered_stops} dostarczonych przystanków
            </span>
          </li>
        );
      })}
    </ul>
  );
}