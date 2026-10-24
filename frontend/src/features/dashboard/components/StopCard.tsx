import { AlertTriangle, MapPin, StickyNote, Undo2 } from 'lucide-react';
import { type LogisticsOrder, type LogisticsStop, type DeliveryProof } from '../../../services/api';
import { STATUS_META } from '../../orders/lib/orders';
import { FAILURE_REASON_LABELS, getNextStep } from '../lib/logisticsStatus';
import { formatTime } from '../lib/dateFormat';
import { ProofPreviewDialog, ProofThumbnail } from './ProofPreview';
import { ReturnsDialog } from './ReturnsDialog';
import { formatMoney, summarizeReturns, type ReturnQuantities } from '../lib/returns';
import { useState } from 'react';

const SMALL_BUTTON = 'min-h-8 px-3 rounded-lg text-[12px] font-extrabold whitespace-nowrap disabled:opacity-40';

function StatusBadge({ status }: { status: LogisticsOrder['status'] }) {
  return (
    <span
      className={`justify-self-start inline-flex px-2.5 py-1 rounded-full text-[11px] font-extrabold whitespace-nowrap ${STATUS_META[status].badge}`}
    >
      {STATUS_META[status].label}
    </span>
  );
}

export function StopCard({
  stop,
  onAdvance,
  updatingId,
  readOnly = false,
  onDeleteProof,
  onSaveReturns,
}: {
  stop: LogisticsStop;
  onAdvance: (orderId: number, nextStatus: LogisticsOrder['status']) => void;
  updatingId: number | null;
  readOnly?: boolean;
  onDeleteProof?: (clientId: number, proofId: number) => Promise<boolean>;
  onSaveReturns?: (clientId: number, quantities: ReturnQuantities) => Promise<boolean>;
}) {
  const hasDeliveryToday = stop.orders.length > 0;
  const hasProblem = stop.orders.some((o) => o.status === 'failed');
  const deliveryNote = stop.orders.find((o) => o.status === 'delivered' && o.delivery_note)?.delivery_note ?? '';
  const [previewProof, setPreviewProof] = useState<DeliveryProof | null>(null);
  const [returnsDialogOpen, setReturnsDialogOpen] = useState(false);
  const returnsSummary = stop.returns ? summarizeReturns(stop.returns) : null;
  const returnedItems = stop.returns?.items.filter((item) => item.returned_quantity > 0) ?? [];

  const deleteProof = async (proof: DeliveryProof) => {
    if (!onDeleteProof) return false;
    const ok = await onDeleteProof(stop.client_id, proof.proof_id);
    if (ok) setPreviewProof(null);
    return ok;
  };

  const submitReturns = async (quantities: ReturnQuantities) => {
    if (!onSaveReturns) return false;
    const ok = await onSaveReturns(stop.client_id, quantities);
    if (ok) setReturnsDialogOpen(false);
    return ok;
  };

  const handleCancel = (order: LogisticsOrder) => {
    const confirmed = window.confirm(
      `Anulować zamówienie „${order.product_name} x${order.quantity}” dla ${stop.name}?\nAnulowane zamówienie zniknie z logistyki.`
    );
    if (confirmed) onAdvance(order.do_id, 'cancelled');
  };

  if (!hasDeliveryToday) {
    return (
      <div className="px-3.5 py-2.5 rounded-xl border border-dashed border-bakery-btnBorder flex flex-wrap items-center justify-between gap-2 text-[#8a8482]">
        <span className="flex flex-col">
          <span className="text-[14px] font-extrabold">{stop.name}</span>
          <span className="text-[12px] font-semibold">{stop.address}</span>
        </span>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.04em]">Brak dostawy</span>
      </div>
    );
  }

  return (
    <div
      className={`@container rounded-xl border bg-white flex flex-col ${
        hasProblem ? 'border-[#e9b4b4] ring-1 ring-[#f8cccc]' : 'border-[#e2dcda]'
      }`}
    >
      <div className="px-3.5 pt-3 pb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 text-[15px] font-extrabold">{stop.name}</p>
          <p className="m-0 mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-[#5f5a58]">
            <MapPin aria-hidden className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{stop.address}</span>
          </p>
        </div>
        {hasProblem && (
          <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#f8cccc] text-[11px] font-extrabold text-[#8f1616]">
            <AlertTriangle aria-hidden className="w-3 h-3" /> Problem
          </span>
        )}
      </div>

      <ul className="m-0 p-0 list-none border-t border-[#eee9e7] divide-y divide-[#eee9e7]">
        {stop.orders.map((order) => {
          const next = readOnly ? null : getNextStep(order.status);
          const busy = updatingId === order.do_id;
          return (
            <li key={order.do_id} className="px-3.5 py-2 flex flex-col gap-1">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5 @lg:grid-cols-[minmax(0,1fr)_112px_176px]">
                <span className="col-span-2 @lg:col-span-1 min-w-0 text-[13px] font-bold">
                  {order.product_name}{' '}
                  <span className="font-semibold text-[#5f5a58] tabular-nums">× {order.quantity}</span>
                </span>
                <StatusBadge status={order.status} />
                <span className="flex items-center justify-end gap-2">
                  {!readOnly && order.status === 'failed' && (
                    <button
                      type="button"
                      onClick={() => handleCancel(order)}
                      disabled={busy}
                      className={`${SMALL_BUTTON} border border-[#e9b4b4] bg-white text-[#b91c1c]`}
                    >
                      Anuluj
                    </button>
                  )}
                  {next && (
                    <button
                      type="button"
                      onClick={() => onAdvance(order.do_id, next.status)}
                      disabled={busy}
                      className={`${SMALL_BUTTON} bg-bakery-dark text-white hover:bg-[#3d3937]`}
                    >
                      {busy ? '…' : next.label}
                    </button>
                  )}
                </span>
              </div>
              {order.status === 'failed' && (
                <p className="m-0 text-[12px] font-bold text-[#991b1b]">
                  {order.failure_reason && FAILURE_REASON_LABELS[order.failure_reason]}
                  {order.failed_at && ` · ${formatTime(order.failed_at)}`}
                  {order.failure_note && (
                    <span className="font-semibold text-[#4a4543]"> — „{order.failure_note}”</span>
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {(deliveryNote || stop.proofs.length > 0 || (returnsSummary && (returnsSummary.count > 0 || onSaveReturns))) && (
        <div className="mt-auto px-3.5 py-2.5 border-t border-[#eee9e7] flex flex-col gap-2">
          {deliveryNote && (
            <p className="m-0 flex items-start gap-1.5 px-3 py-2 rounded-lg bg-[#fdf3e2] text-[12px] font-semibold text-[#5c3300]">
              <StickyNote aria-hidden className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span className="break-words">„{deliveryNote}”</span>
            </p>
          )}
          {stop.proofs.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {stop.proofs.map((proof) => (
                <ProofThumbnail key={proof.proof_id} proof={proof} stopName={stop.name} onOpen={setPreviewProof} />
              ))}
            </div>
          )}
          {returnsSummary && (returnsSummary.count > 0 || onSaveReturns) && (
            <div className="flex items-center justify-between gap-2 text-[12px] font-semibold">
              <p className="m-0 flex items-start gap-1.5 min-w-0">
                <Undo2 aria-hidden className="w-3.5 h-3.5 text-bakery-accent shrink-0 mt-px" />
                {returnsSummary.count > 0 ? (
                  <span className="break-words">
                    Zwroty: {returnedItems.map((i) => `${i.product_name} ×${i.returned_quantity}`).join(', ')} ·{' '}
                    <strong>{formatMoney(returnsSummary.value)}</strong>
                  </span>
                ) : (
                  <span className="text-[#5f5a58]">Brak zwrotów</span>
                )}
              </p>
              {onSaveReturns && (
                <button
                  type="button"
                  onClick={() => setReturnsDialogOpen(true)}
                  className={`${SMALL_BUTTON} shrink-0 border border-bakery-btnBorder bg-white hover:border-[#8f8a88]`}
                >
                  {returnsSummary.count > 0 ? 'Popraw' : 'Dodaj zwrot'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {previewProof && (
        <ProofPreviewDialog
          proof={previewProof}
          stopName={stop.name}
          canDelete={!!onDeleteProof}
          onDelete={deleteProof}
          onClose={() => setPreviewProof(null)}
        />
      )}
      {returnsDialogOpen && stop.returns && (
        <ReturnsDialog
          subtitle={stop.name}
          returns={stop.returns}
          onSubmit={submitReturns}
          onClose={() => setReturnsDialogOpen(false)}
        />
      )}
    </div>
  );
}
