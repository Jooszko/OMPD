import { AlertTriangle, Flame, Info } from 'lucide-react';
import type { PlanPreviewDough } from '../../../../services/api';
import { formatPieces, MIXER_LOAD_COLORS, MIXER_LOAD_LABELS, mixerLoad } from '../../lib/planning';
import { formatAmount, formatKg } from '../../lib/productionStage';
import { MixerBar } from './MixerBar';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-[1_1_140px] min-w-0 flex flex-col gap-1 px-4 py-3 rounded-[14px] bg-white border border-[#e6e1df]">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]">{label}</span>
      <span className="font-display text-[20px] leading-tight font-extrabold tabular-nums break-words">{value}</span>
    </div>
  );
}

export function DoughDetail({ dough }: { dough: PlanPreviewDough }) {
  const batches = dough.batches.length;
  return (
    <section
      aria-labelledby="dough-title"
      className="flex flex-col gap-5 p-4 sm:p-6 rounded-[18px] bg-bakery-card border border-bakery-btnBorder"
    >
      <div className="flex flex-col gap-1">
        <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]">Szczegóły ciasta</span>
        <h2 id="dough-title" className="m-0 font-display text-[26px] sm:text-[30px] leading-tight font-extrabold">
          {dough.name}
        </h2>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <Fact label="Masa kęsów" value={formatKg(Number(dough.raw_mass_kg))} />
        <Fact label={`Bufor strat ${dough.loss_buffer_pct}%`} value={formatKg(Number(dough.total_mass_kg))} />
        <Fact
          label="Mieszałka"
          value={dough.mixer ? `${dough.mixer.name}` : 'brak'}
        />
        {dough.mixer && (
          <Fact
            label="Wsad min. – maks."
            value={`${formatKg(Number(dough.mixer.min_capacity_kg))} – ${formatKg(Number(dough.mixer.max_capacity_kg))}`}
          />
        )}
      </div>

      {(dough.notes.length > 0 || dough.warnings.length > 0) && (
        <ul className="m-0 p-0 list-none flex flex-col gap-2">
          {dough.warnings.map((warning) => (
            <li key={warning} className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl bg-[#fff1d6] text-[13px] font-semibold text-[#6b4300]">
              <AlertTriangle aria-hidden className="size-4 shrink-0 mt-0.5" /> {warning}
            </li>
          ))}
          {dough.notes.map((note) => (
            <li key={note} className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl bg-[#f0ece9] text-[13px] font-semibold text-[#3d3937]">
              <Info aria-hidden className="size-4 shrink-0 mt-0.5" /> {note}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-sm font-extrabold">Wyroby z tego ciasta</h3>
        <ul className="m-0 p-0 list-none rounded-[14px] bg-white border border-[#e6e1df] overflow-hidden">
          {dough.products.map((product) => (
            <li
              key={product.product_id}
              className="grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,1.6fr)_110px_90px_110px_150px] items-center gap-x-4 gap-y-0.5 px-4 py-2.5 border-t border-[#e6e1df] first:border-t-0"
            >
              <span className="min-w-0 text-[14px] font-extrabold truncate">{product.product_name}</span>
              <span className="text-sm font-extrabold tabular-nums text-right sm:text-left">{formatPieces(product.ordered_qty)}</span>
              <span className="text-xs font-semibold text-[#5f5a58] tabular-nums">
                <span className="sm:hidden">kęs </span>
                {formatAmount(Number(product.piece_weight_kg), 'kg')}
              </span>
              <span className="text-xs font-semibold text-[#5f5a58] tabular-nums text-right sm:text-left">
                {formatKg(Number(product.raw_mass_kg))}
              </span>
              <span className="col-span-2 sm:col-span-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[#5f5a58]">
                <Flame aria-hidden className="size-3.5 text-bakery-accent" />
                {product.bake_temp_c} °C · {product.bake_time_min} min
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-sm font-extrabold">Dzieże i odważenia</h3>
        <ol className="m-0 p-0 list-none grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-3">
          {dough.batches.map((batch) => {
            const load = mixerLoad(Number(batch.dough_mass_kg), dough.mixer);
            return (
              <li key={batch.sequence} className="flex flex-col gap-3 p-4 rounded-[14px] bg-white border border-[#e6e1df]">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-extrabold">
                    Dzieża {batch.sequence} z {batches}
                  </span>
                  <span className="font-display text-[20px] leading-none font-extrabold tabular-nums">
                    {formatKg(Number(batch.dough_mass_kg))}
                  </span>
                </div>
                {load && (
                  <div className="flex flex-col gap-1.5">
                    <MixerBar massKg={Number(batch.dough_mass_kg)} mixer={dough.mixer} />
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#5f5a58]">
                      <span aria-hidden className="size-2 rounded-full" style={{ background: MIXER_LOAD_COLORS[load.state] }} />
                      {Math.round(load.pct)}% pojemności · {MIXER_LOAD_LABELS[load.state].toLowerCase()}
                    </span>
                  </div>
                )}
                <ul className="m-0 p-0 list-none flex flex-wrap gap-1.5">
                  {batch.outputs.map((output) => (
                    <li key={output.product_id} className="px-2.5 py-1 rounded-full bg-[#f6f2f0] text-xs font-bold">
                      {output.product_name} <span className="tabular-nums">{output.pieces} szt.</span>
                    </li>
                  ))}
                </ul>
                <ul className="m-0 p-0 list-none flex flex-col">
                  {batch.ingredients.map((item) => (
                    <li key={item.ingredient_id} className="flex justify-between gap-2 py-1 border-t border-[#f0ece9] text-xs">
                      <span className="min-w-0 font-semibold text-[#3d3937]">{item.name}</span>
                      <span className="shrink-0 font-extrabold tabular-nums">{formatAmount(Number(item.amount), item.unit)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
