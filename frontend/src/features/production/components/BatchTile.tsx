import { AlertTriangle, ChevronRight, Clock, User } from 'lucide-react';
import type { ProductionBatch } from '../../../services/api';
import { STAGE_COLORS, STAGE_LABELS, formatKg, getBatchAction, getStageTimer } from '../lib/productionStage';

export function StageBadge({ batch, large = false }: { batch: ProductionBatch; large?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-lg font-extrabold uppercase tracking-wide ${STAGE_COLORS[batch.stage]} ${
        large ? 'px-3 py-1.5 text-base' : 'px-2 py-1 text-xs'
      }`}
    >
      {STAGE_LABELS[batch.stage]}
      {batch.stage !== 'done' && !batch.stage_started_at && ' · czeka'}
    </span>
  );
}

export function StageTimerLabel({ batch, now }: { batch: ProductionBatch; now: number }) {
  const timer = getStageTimer(batch, now);
  if (!timer) return null;
  return (
    <span className={`inline-flex items-center gap-1 font-bold tabular-nums ${timer.overdue ? 'text-red-700' : ''}`}>
      <Clock className="w-4 h-4" />
      {timer.elapsed} min{timer.target !== null && ` / ${timer.target} min`}
      {timer.overdue && ' — przekroczono'}
    </span>
  );
}

export function BatchTile({
  batch,
  now,
  busy,
  onAction,
  onWaste,
  onOpen,
}: {
  batch: ProductionBatch;
  now: number;
  busy: boolean;
  onAction: () => void;
  onWaste: () => void;
  onOpen: () => void;
}) {
  const action = getBatchAction(batch);
  const pieces = batch.outputs.reduce((sum, o) => sum + o.planned_pieces, 0);
  const waste = batch.outputs.reduce((sum, o) => sum + o.waste_pieces, 0);
  const active = Boolean(batch.stage_started_at);

  return (
    <article
      className={`flex flex-col rounded-2xl border-4 bg-white text-bakery-dark shadow-md overflow-hidden ${
        active ? 'border-bakery-accent' : batch.stage === 'done' ? 'border-emerald-700 opacity-80' : 'border-bakery-dark'
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-col gap-2 p-4 text-left active:bg-bakery-rowBg"
        aria-label={`Szczegóły: ${batch.dough_name} dzieża ${batch.sequence}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="m-0 text-xl font-extrabold leading-tight">{batch.dough_name}</h3>
            <p className="m-0 text-base font-bold text-gray-600">
              Dzieża {batch.sequence} z {batch.batch_count} · {formatKg(batch.dough_mass_kg)}
            </p>
          </div>
          <ChevronRight className="w-7 h-7 shrink-0 text-gray-400" />
        </div>
        <StageBadge batch={batch} />
        <ul className="m-0 p-0 list-none text-base font-semibold">
          {batch.outputs.map((o) => (
            <li key={o.product_id} className="flex justify-between gap-2">
              <span className="truncate">{o.product_name}</span>
              <span className="tabular-nums font-extrabold">{o.good_pieces} szt.</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
          {batch.stage_worker && (
            <span className="inline-flex items-center gap-1 font-bold">
              <User className="w-4 h-4" /> {batch.stage_worker.full_name}
            </span>
          )}
          <StageTimerLabel batch={batch} now={now} />
          {waste > 0 && (
            <span className="inline-flex items-center gap-1 font-bold text-red-700">
              <AlertTriangle className="w-4 h-4" /> strata {waste} z {pieces} szt.
            </span>
          )}
        </div>
      </button>

      {action.kind !== 'none' && (
        <div className="mt-auto grid grid-cols-[1fr_auto] gap-2 p-3 pt-0">
          <button
            type="button"
            onClick={onAction}
            disabled={busy}
            className={`min-h-16 rounded-xl text-xl font-extrabold active:scale-[0.98] disabled:opacity-50 ${
              action.kind === 'start' ? 'bg-bakery-dark text-white' : 'bg-bakery-accent text-black'
            }`}
          >
            {busy ? '…' : action.label}
          </button>
          <button
            type="button"
            onClick={onWaste}
            disabled={busy}
            aria-label="Zgłoś stratę"
            className="min-h-16 px-4 rounded-xl border-2 border-red-700 text-red-700 bg-white font-extrabold active:scale-[0.98] disabled:opacity-50"
          >
            <AlertTriangle className="w-6 h-6 mx-auto" />
            <span className="block text-xs">Strata</span>
          </button>
        </div>
      )}
    </article>
  );
}
