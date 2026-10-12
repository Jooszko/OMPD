import { type ReactNode, useState } from 'react';
import { CircleCheck, Circle, Flame, Thermometer, Timer } from 'lucide-react';
import type { ProductionBatch } from '../../../services/api';
import { Modal } from '../../dashboard/components/Modal';
import { formatTime } from '../../dashboard/lib/dateFormat';
import { formatAmount, formatKg, getBatchAction } from '../lib/productionStage';
import { StageBadge, StageTimerLabel } from './BatchTile';

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-bakery-rowBg px-3 py-2">
      {icon}
      <div>
        <div className="text-xs font-bold uppercase text-gray-500">{label}</div>
        <div className="text-xl font-extrabold tabular-nums">{value}</div>
      </div>
    </div>
  );
}

/** Lista odważeń — dotknięcie wiersza odhacza składnik (tylko lokalnie, jako pomoc przy wadze). */
function WeighList({ batch }: { batch: ProductionBatch }) {
  const [weighed, setWeighed] = useState<Set<number>>(new Set());
  const toggle = (id: number) =>
    setWeighed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (batch.ingredients.length === 0) {
    return <p className="m-0 text-sm font-semibold text-gray-500">Ciasto nie ma zdefiniowanej receptury.</p>;
  }
  return (
    <ul className="m-0 p-0 list-none flex flex-col gap-2">
      {batch.ingredients.map((item) => {
        const done = weighed.has(item.ingredient_id);
        return (
          <li key={item.ingredient_id}>
            <button
              type="button"
              onClick={() => toggle(item.ingredient_id)}
              aria-pressed={done}
              className={`w-full min-h-14 flex items-center gap-3 px-3 rounded-xl border-2 text-left active:scale-[0.99] ${
                done ? 'bg-emerald-50 border-emerald-700 text-emerald-900' : 'bg-white border-bakery-btnBorder'
              }`}
            >
              {done ? <CircleCheck className="w-7 h-7 shrink-0" /> : <Circle className="w-7 h-7 shrink-0 text-gray-400" />}
              <span className={`flex-1 text-lg font-bold ${done ? 'line-through' : ''}`}>{item.name}</span>
              <span className="text-2xl font-extrabold tabular-nums">{formatAmount(item.amount, item.unit)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function StageInstructions({ batch }: { batch: ProductionBatch }) {
  switch (batch.stage) {
    case 'mixing':
      return (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Fact icon={<Timer className="w-6 h-6" />} label="Czas mieszania" value={`${batch.mixing.mixing_time_min} min`} />
            <Fact icon={<Thermometer className="w-6 h-6" />} label="Temp. ciasta" value={`${batch.mixing.target_dough_temp_c} °C`} />
            <Fact icon={<Flame className="w-6 h-6" />} label="Masa wsadu" value={formatKg(batch.dough_mass_kg)} />
          </div>
          {batch.mixing.instructions && (
            <p className="m-0 rounded-xl bg-sky-50 border-2 border-sky-700 px-3 py-2 text-base font-semibold text-sky-950">
              {batch.mixing.instructions}
            </p>
          )}
          <h3 className="m-0 text-sm font-bold uppercase tracking-wide text-gray-600">Do odważenia</h3>
          <WeighList batch={batch} />
        </>
      );
    case 'dividing':
      return (
        <table className="w-full text-lg">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500">
              <th className="py-1">Wyrób</th>
              <th className="py-1 text-right">Kęs</th>
              <th className="py-1 text-right">Sztuk</th>
            </tr>
          </thead>
          <tbody>
            {batch.outputs.map((o) => (
              <tr key={o.product_id} className="border-t border-bakery-btnBorder font-bold">
                <td className="py-2">{o.product_name}</td>
                <td className="py-2 text-right tabular-nums">{formatAmount(o.piece_weight_kg, 'kg')}</td>
                <td className="py-2 text-right text-2xl font-extrabold tabular-nums">{o.good_pieces}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    case 'proofing':
      return (
        <Fact icon={<Timer className="w-6 h-6" />} label="Czas garowania" value={`${batch.proofing_time_min} min`} />
      );
    case 'baking':
      return (
        <ul className="m-0 p-0 list-none flex flex-col gap-2">
          {batch.outputs.map((o) => (
            <li key={o.product_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-bakery-rowBg px-3 py-2">
              <span className="text-lg font-bold">{o.product_name}</span>
              <span className="text-xl font-extrabold tabular-nums">
                {o.bake_temp_c} °C · {o.bake_time_min} min · {o.good_pieces} szt.
              </span>
            </li>
          ))}
        </ul>
      );
    default:
      return (
        <p className="m-0 text-lg font-bold text-emerald-800">
          Partia zakończona — {batch.outputs.reduce((s, o) => s + o.good_pieces, 0)} szt. przyjęto na magazyn.
        </p>
      );
  }
}

export function BatchDetailDialog({
  batch,
  now,
  busy,
  onAction,
  onWaste,
  onClose,
}: {
  batch: ProductionBatch;
  now: number;
  busy: boolean;
  onAction: () => void;
  onWaste: () => void;
  onClose: () => void;
}) {
  const action = getBatchAction(batch);

  return (
    <Modal
      size="xl"
      title={`${batch.dough_name} — dzieża ${batch.sequence} z ${batch.batch_count}`}
      subtitle={`${formatKg(batch.dough_mass_kg)}${batch.mixer_name ? ` · ${batch.mixer_name}` : ''}`}
      onClose={onClose}
    >
      <div className="flex flex-wrap items-center gap-3 text-base">
        <StageBadge batch={batch} large />
        {batch.stage_worker && <span className="font-bold">{batch.stage_worker.full_name}</span>}
        <StageTimerLabel batch={batch} now={now} />
      </div>

      <StageInstructions batch={batch} />

      {action.kind !== 'none' && (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button
            type="button"
            onClick={onAction}
            disabled={busy}
            className={`min-h-16 rounded-xl text-xl font-extrabold active:scale-[0.98] disabled:opacity-50 ${
              action.kind === 'start' ? 'bg-bakery-dark text-white' : 'bg-bakery-accent text-black'
            }`}
          >
            {busy ? 'Zapisywanie…' : action.label}
          </button>
          <button
            type="button"
            onClick={onWaste}
            disabled={busy}
            className="min-h-16 px-5 rounded-xl border-2 border-red-700 text-red-700 bg-white text-lg font-extrabold active:scale-[0.98]"
          >
            Zgłoś stratę
          </button>
        </div>
      )}

      {(batch.history.length > 0 || batch.waste.length > 0) && (
        <details className="rounded-xl border border-bakery-btnBorder px-3 py-2">
          <summary className="cursor-pointer text-sm font-bold uppercase tracking-wide text-gray-600 min-h-10 flex items-center">
            Historia partii
          </summary>
          <ol className="m-0 mt-2 pl-0 list-none flex flex-col gap-1 text-sm">
            {batch.history.map((entry, i) => (
              <li key={`h${i}`} className="flex flex-wrap justify-between gap-2 border-t border-bakery-btnBorder pt-1">
                <span className="font-bold">{entry.stage_label}</span>
                <span>
                  {entry.started_by?.full_name ?? '—'} · {formatTime(entry.started_at)}
                  {entry.finished_at && ` → ${formatTime(entry.finished_at)}`}
                  {entry.finished_by && entry.finished_by.user_id !== entry.started_by?.user_id &&
                    ` (zakończył(a): ${entry.finished_by.full_name})`}
                </span>
              </li>
            ))}
            {batch.waste.map((w) => (
              <li key={`w${w.waste_id}`} className="flex flex-wrap justify-between gap-2 border-t border-bakery-btnBorder pt-1 text-red-800">
                <span className="font-bold">
                  Strata: {w.quantity} × {w.product_name} ({w.reason_label})
                </span>
                <span>
                  {w.stage_label} · {w.recorded_by?.full_name ?? '—'} · {formatTime(w.created_at)}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </Modal>
  );
}
