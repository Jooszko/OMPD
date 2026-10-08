import { type FormEvent, useState } from 'react';
import { Minus, Plus, Undo2 } from 'lucide-react';
import type { StopReturns } from '../../../services/api';
import { formatDayLabel } from '../lib/dateFormat';
import {
  clampReturnQuantity,
  formatMoney,
  initialReturnQuantities,
  summarizeReturns,
  type ReturnQuantities,
} from '../lib/returns';
import { Modal } from './Modal';

const STEP_BUTTON =
  'w-11 h-11 sm:w-8 sm:h-8 inline-flex items-center justify-center bg-white border border-bakery-btnBorder rounded-lg text-bakery-dark transition hover:bg-bakery-inactive active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed';

export function ReturnsDialog({
  subtitle,
  returns,
  onSubmit,
  onClose,
}: {
  subtitle: string;
  returns: StopReturns;
  onSubmit: (quantities: ReturnQuantities) => Promise<boolean>;
  onClose: () => void;
}) {
  const [initial] = useState(() => initialReturnQuantities(returns));
  const [quantities, setQuantities] = useState<ReturnQuantities>(initial);
  const [submitting, setSubmitting] = useState(false);

  const unchanged = returns.items.every((item) => quantities[item.product_id] === initial[item.product_id]);
  const summary = summarizeReturns(returns, quantities);

  const setQuantity = (productId: number, max: number, value: number) =>
    setQuantities((prev) => ({ ...prev, [productId]: clampReturnQuantity(value, max) }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (unchanged || submitting) return;
    setSubmitting(true);
    const ok = await onSubmit(quantities);
    if (!ok) setSubmitting(false);
  };

  return (
    <Modal
      title="Zwroty towaru"
      subtitle={subtitle}
      icon={<Undo2 className="w-5 h-5 text-bakery-accent" />}
      initialFocusSelector="input"
      closeDisabled={submitting}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="m-0 text-xs text-gray-500">
          Niesprzedany towar z dostawy z dnia: <span className="font-semibold">{formatDayLabel(returns.source_date)}</span>.
          Ustaw, ile sztuk klient oddaje.
        </p>

        <ul className="m-0 p-0 list-none flex flex-col gap-2">
          {returns.items.map((item) => {
            const value = quantities[item.product_id] ?? 0;
            const inputId = `return-${item.product_id}`;
            return (
              <li
                key={item.product_id}
                className="flex items-center gap-3 bg-bakery-rowBg border border-bakery-btnBorder rounded-lg px-3 py-2"
              >
                <label htmlFor={inputId} className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-bakery-dark truncate">{item.product_name}</span>
                  <span className="block text-[11px] text-gray-500">dostarczono {item.delivered_quantity} szt.</span>
                </label>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setQuantity(item.product_id, item.delivered_quantity, value - 1)}
                    disabled={submitting || value === 0}
                    aria-label={`Mniej: ${item.product_name}`}
                    className={STEP_BUTTON}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    id={inputId}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={item.delivered_quantity}
                    value={value}
                    onChange={(e) => setQuantity(item.product_id, item.delivered_quantity, e.target.valueAsNumber)}
                    onFocus={(e) => e.target.select()}
                    disabled={submitting}
                    className="w-14 h-11 sm:h-8 text-center text-sm font-bold tabular-nums bg-white border border-bakery-btnBorder rounded-lg outline-none focus:border-bakery-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(item.product_id, item.delivered_quantity, value + 1)}
                    disabled={submitting || value === item.delivered_quantity}
                    aria-label={`Więcej: ${item.product_name}`}
                    className={STEP_BUTTON}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="m-0 flex items-center justify-between text-xs font-semibold text-gray-600">
          <span>Razem: {summary.count} szt.</span>
          <span>
            Wartość: <strong className="text-bakery-dark">{formatMoney(summary.value)}</strong>
          </span>
        </p>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="min-h-[44px] sm:min-h-0 px-4 py-2 text-xs font-bold bg-white border border-bakery-btnBorder rounded-lg hover:bg-bakery-inactive"
          >
            Anuluj
          </button>
          <button
            type="submit"
            disabled={unchanged || submitting}
            className="min-h-[44px] sm:min-h-0 px-4 py-2 text-xs font-bold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Zapisywanie...' : 'Zapisz zwroty'}
          </button>
        </div>
      </form>
    </Modal>
  );
}