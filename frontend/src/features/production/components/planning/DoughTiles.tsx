import { AlertTriangle } from 'lucide-react';
import type { PlanPreviewDough } from '../../../../services/api';
import { plural } from '../../../home/lib/home';
import { MIXER_LOAD_LABELS, peakLoad } from '../../lib/planning';
import { formatKg } from '../../lib/productionStage';
import { MixerBar } from './MixerBar';

export function DoughTiles({
  doughs,
  selectedId,
  onSelect,
}: {
  doughs: PlanPreviewDough[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <ul className="m-0 p-0 list-none grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
      {doughs.map((dough) => {
        const active = dough.dough_id === selectedId;
        const load = peakLoad(dough);
        const heaviest = Math.max(0, ...dough.batches.map((batch) => Number(batch.dough_mass_kg)));
        const batches = dough.batches.length;
        const products = dough.products.length;
        return (
          <li key={dough.dough_id}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(dough.dough_id)}
              className={`w-full h-full flex flex-col gap-3 p-4 rounded-[18px] border text-left cursor-pointer transition ${
                active
                  ? 'bg-bakery-dark border-bakery-dark text-white'
                  : 'bg-bakery-card border-bakery-btnBorder text-bakery-dark hover:border-bakery-dark'
              }`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-[15px] font-extrabold leading-tight">{dough.name}</span>
                {dough.warnings.length > 0 && (
                  <span
                    title={dough.warnings.join('\n')}
                    className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#4a3410] text-[#ffe2b0] text-[11px] font-extrabold"
                  >
                    <AlertTriangle aria-hidden className="size-3" />
                    {dough.warnings.length}
                  </span>
                )}
              </span>
              <span className="font-display text-[30px] leading-none font-extrabold tabular-nums">
                {formatKg(Number(dough.total_mass_kg))}
              </span>
              <span className={`text-xs font-bold ${active ? 'text-[#d9d2cf]' : 'text-[#5f5a58]'}`}>
                {batches} {plural(batches, 'dzieża', 'dzieże', 'dzieży')} · {products}{' '}
                {plural(products, 'wyrób', 'wyroby', 'wyrobów')}
              </span>
              {load && dough.mixer ? (
                <span className="flex flex-col gap-1.5">
                  <MixerBar massKg={heaviest} mixer={dough.mixer} dark={active} />
                  <span className={`text-[11px] font-bold ${active ? 'text-[#d9d2cf]' : 'text-[#5f5a58]'}`}>
                    {Math.round(load.pct)}% pojemności mieszałki
                    {load.state !== 'ok' && ` · ${MIXER_LOAD_LABELS[load.state].toLowerCase()}`}
                  </span>
                </span>
              ) : (
                <span className="text-[11px] font-bold text-[#e5484d]">Brak mieszałki</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
