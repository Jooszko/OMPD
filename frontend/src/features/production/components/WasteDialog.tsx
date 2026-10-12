import { useState } from 'react';
import { AlertTriangle, Minus, Plus } from 'lucide-react';
import type { ProductionBatch, ProductionBoard, WasteReason } from '../../../services/api';
import { Modal } from '../../dashboard/components/Modal';
import { STAGE_LABELS } from '../lib/productionStage';

const STEP_BUTTON =
  'flex items-center justify-center min-w-[64px] h-16 px-3 rounded-xl text-xl font-extrabold border-2 border-bakery-dark bg-white text-bakery-dark active:scale-[0.97] disabled:opacity-30';

/** Zgłoszenie straty bez klawiatury: kafelki wyrobu i powodu, licznik sterowany przyciskami. */
export function WasteDialog({
  batch,
  reasons,
  busy,
  onSubmit,
  onClose,
}: {
  batch: ProductionBatch;
  reasons: ProductionBoard['waste_reasons'];
  busy: boolean;
  onSubmit: (payload: { product_id: number; quantity: number; reason: WasteReason }) => void;
  onClose: () => void;
}) {
  const products = batch.outputs.filter((o) => o.good_pieces > 0);
  const [productId, setProductId] = useState<number | null>(products.length === 1 ? products[0].product_id : null);
  const [reason, setReason] = useState<WasteReason | null>(null);
  const [quantity, setQuantity] = useState(1);

  const selected = products.find((p) => p.product_id === productId);
  const maxQuantity = selected?.good_pieces ?? 1;
  const change = (delta: number) => setQuantity((q) => Math.min(maxQuantity, Math.max(1, q + delta)));
  const canSubmit = selected && reason && quantity >= 1 && quantity <= maxQuantity && !busy;

  return (
    <Modal
      size="xl"
      title="Zgłoś stratę"
      subtitle={`${batch.dough_name} #${batch.sequence} · etap: ${STAGE_LABELS[batch.stage]}`}
      icon={<AlertTriangle className="w-5 h-5 text-red-700" />}
      closeDisabled={busy}
      onClose={onClose}
    >
      <section>
        <h3 className="m-0 mb-2 text-sm font-bold uppercase tracking-wide text-gray-600">1. Który wyrób?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {products.map((p) => (
            <button
              key={p.product_id}
              type="button"
              onClick={() => {
                setProductId(p.product_id);
                setQuantity((q) => Math.min(q, p.good_pieces));
              }}
              aria-pressed={productId === p.product_id}
              className={`min-h-16 px-4 py-3 rounded-xl border-2 text-left text-lg font-bold active:scale-[0.98] ${
                productId === p.product_id
                  ? 'bg-bakery-dark text-white border-bakery-dark'
                  : 'bg-white text-bakery-dark border-bakery-btnBorder'
              }`}
            >
              {p.product_name}
              <span className="block text-sm font-semibold opacity-75">pozostało {p.good_pieces} szt.</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="m-0 mb-2 text-sm font-bold uppercase tracking-wide text-gray-600">2. Ile sztuk?</h3>
        <div className="flex items-center gap-2">
          <button type="button" className={STEP_BUTTON} onClick={() => change(-5)} disabled={quantity <= 1}>
            −5
          </button>
          <button type="button" className={STEP_BUTTON} onClick={() => change(-1)} disabled={quantity <= 1} aria-label="Mniej o 1">
            <Minus className="w-6 h-6" />
          </button>
          <output className="flex-1 h-16 flex items-center justify-center rounded-xl bg-bakery-rowBg text-4xl font-extrabold tabular-nums">
            {quantity}
          </output>
          <button type="button" className={STEP_BUTTON} onClick={() => change(1)} disabled={quantity >= maxQuantity} aria-label="Więcej o 1">
            <Plus className="w-6 h-6" />
          </button>
          <button type="button" className={STEP_BUTTON} onClick={() => change(5)} disabled={quantity >= maxQuantity}>
            +5
          </button>
        </div>
      </section>

      <section>
        <h3 className="m-0 mb-2 text-sm font-bold uppercase tracking-wide text-gray-600">3. Powód</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {reasons.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setReason(r.value)}
              aria-pressed={reason === r.value}
              className={`min-h-14 px-3 py-2 rounded-xl border-2 text-base font-bold active:scale-[0.98] ${
                reason === r.value
                  ? 'bg-red-700 text-white border-red-700'
                  : 'bg-white text-bakery-dark border-bakery-btnBorder'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </section>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => selected && reason && onSubmit({ product_id: selected.product_id, quantity, reason })}
        className="min-h-16 rounded-xl bg-red-700 text-white text-xl font-extrabold active:scale-[0.98] disabled:opacity-40"
      >
        {busy ? 'Zapisywanie…' : selected ? `Zgłoś stratę: ${quantity} × ${selected.product_name}` : 'Wybierz wyrób'}
      </button>
    </Modal>
  );
}
