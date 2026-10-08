import { type ChangeEvent, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  MapPin,
  Navigation,
  Package,
  Phone,
  StickyNote,
  Camera,
  Signature,
  Undo2,
} from 'lucide-react';
import { type FailureReason, type LogisticsOrder, type LogisticsStop, type DeliveryProof } from '../../../services/api';
import {
  FAILURE_REASON_LABELS,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  getDriverNextStep,
} from '../lib/logisticsStatus';
import { getStopDeliveredAt, getStopState, type StopState } from '../lib/routeProgress';
import { formatTime } from '../lib/dateFormat';
import { buildGoogleMapsStopUrl } from '../lib/navigationLinks';
import { ReportProblemDialog, type ProblemTarget } from './ReportProblemDialog';
import { DeliveryNoteDialog } from './DeliveryNoteDialog';
import { ProofPreviewDialog, ProofThumbnail } from './ProofPreview';
import { SignatureDialog } from './SignatureDialog';
import { ReturnsDialog } from './ReturnsDialog';
import { formatMoney, summarizeReturns, type ReturnQuantities } from '../lib/returns';

const SEQUENCE_BADGE_CLASSES: Record<StopState, string> = {
  none: 'bg-bakery-accent text-black',
  pending: 'bg-bakery-accent text-black',
  delivered: 'bg-emerald-600 text-white',
  failed: 'bg-rose-600 text-white',
};

function StatusBadge({ status }: { status: LogisticsOrder['status'] }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap"
      style={{
        color: ORDER_STATUS_COLORS[status],
        backgroundColor: `${ORDER_STATUS_COLORS[status]}1a`,
        border: `1px solid ${ORDER_STATUS_COLORS[status]}40`,
      }}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

function SequenceBadge({ sequence, state }: { sequence: number; state: StopState }) {
  return (
    <span
      className={`shrink-0 w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center ${SEQUENCE_BADGE_CLASSES[state]}`}
    >
      {sequence}
    </span>
  );
}

interface ProblemDialogState {
  target: ProblemTarget;
  title: string;
  subtitle: string;
}

const SECONDARY_ICON_BUTTON =
  'inline-flex items-center justify-center gap-1.5 w-11 h-11 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 text-xs font-bold bg-white border border-bakery-btnBorder text-bakery-dark rounded-lg shadow-xs transition hover:bg-bakery-inactive active:scale-[0.98]';

const PROBLEM_BUTTON =
  'inline-flex items-center justify-center gap-1.5 shrink-0 text-xs font-bold bg-white border border-rose-200 text-rose-700 rounded-lg shadow-xs transition hover:bg-rose-50 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed';

export function DriverStopCard({
  stop,
  sequence,
  isNext = false,
  readOnly = false,
  onAdvance,
  updatingId,
  onDeliverStop,
  deliveringStopId,
  onReportProblem,
  onSaveDeliveryNote,
  onUploadProof,
  onDeleteProof,
  onSaveReturns,
}: {
  stop: LogisticsStop;
  sequence?: number | null;
  isNext?: boolean;
  readOnly?: boolean;
  onAdvance: (orderId: number, nextStatus: LogisticsOrder['status']) => void;
  updatingId: number | null;
  onDeliverStop: (clientId: number) => void;
  deliveringStopId: number | null;
  onReportProblem: (target: ProblemTarget, reason: FailureReason, note: string) => Promise<boolean>;
  onSaveDeliveryNote: (clientId: number, note: string) => Promise<boolean>;
  onUploadProof: (clientId: number, kind: DeliveryProof['kind'], image: Blob, signerName?: string) => Promise<boolean>;
  onDeleteProof: (clientId: number, proofId: number) => Promise<boolean>;
  onSaveReturns: (clientId: number, quantities: ReturnQuantities) => Promise<boolean>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [problemDialog, setProblemDialog] = useState<ProblemDialogState | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [previewProof, setPreviewProof] = useState<DeliveryProof | null>(null);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [returnsDialogOpen, setReturnsDialogOpen] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const hasDeliveryToday = stop.orders.length > 0;
  const inDeliveryCount = stop.orders.filter((o) => o.status === 'in_delivery').length;
  const isDeliveringStop = deliveringStopId === stop.client_id;
  const stopState = getStopState(stop);
  const handled = stopState === 'delivered' || stopState === 'failed';
  const deliveredAt = stopState === 'delivered' ? getStopDeliveredAt(stop) : null;
  const failureReason = stop.orders.find((o) => o.status === 'failed')?.failure_reason || null;
  const showCall = !readOnly && hasDeliveryToday && stopState !== 'delivered' && !!stop.phone;
  const showNavigate = !readOnly && stopState === 'pending';
  const hasDeliveredOrders = stop.orders.some((o) => o.status === 'delivered');
  const deliveryNote = stop.orders.find((o) => o.status === 'delivered' && o.delivery_note)?.delivery_note ?? '';
  const photo = stop.proofs.find((p) => p.kind === 'photo') ?? null;
  const signature = stop.proofs.find((p) => p.kind === 'signature') ?? null;
  const canAddProof = !readOnly && hasDeliveredOrders;
  const returnsSummary = stop.returns ? summarizeReturns(stop.returns) : null;
  const canRecordReturns =
    !readOnly && !!stop.returns && stop.orders.some((o) => o.status === 'in_delivery' || o.status === 'delivered');

  const openStopProblem = () =>
    setProblemDialog({
      target: { kind: 'stop', clientId: stop.client_id },
      title: 'Problem z dostawą',
      subtitle: `${stop.name} · ${inDeliveryCount} poz. w dostawie`,
    });

  const openOrderProblem = (order: LogisticsOrder) =>
    setProblemDialog({
      target: { kind: 'order', orderId: order.do_id },
      title: 'Problem z pozycją',
      subtitle: `${stop.name} · ${order.product_name} x${order.quantity}`,
    });

  const submitProblem = async (reason: FailureReason, note: string) => {
    if (!problemDialog) return false;
    const ok = await onReportProblem(problemDialog.target, reason, note);
    if (ok) setProblemDialog(null);
    return ok;
  };

  const submitDeliveryNote = async (note: string) => {
    const ok = await onSaveDeliveryNote(stop.client_id, note);
    if (ok) setNoteDialogOpen(false);
    return ok;
  };

  const handlePhotoSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingPhoto(true);
    await onUploadProof(stop.client_id, 'photo', file);
    setUploadingPhoto(false);
  };

  const deleteProof = async (proof: DeliveryProof) => {
    const ok = await onDeleteProof(stop.client_id, proof.proof_id);
    if (ok) setPreviewProof(null);
    return ok;
  };

  const submitSignature = async (image: Blob, signerName: string) => {
    const ok = await onUploadProof(stop.client_id, 'signature', image, signerName);
    if (ok) setSignatureDialogOpen(false);
    return ok;
  };

  const submitReturns = async (quantities: ReturnQuantities) => {
    const ok = await onSaveReturns(stop.client_id, quantities);
    if (ok) setReturnsDialogOpen(false);
    return ok;
  };

  if (handled && !expanded) {
    const failed = stopState === 'failed';
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-expanded={false}
        className={`w-full text-left border rounded-lg px-3 py-2 flex items-center gap-2.5 transition ${
          failed
            ? 'border-rose-200 bg-rose-50/60 hover:bg-rose-50'
            : 'border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50'
        }`}
      >
        {sequence != null ? (
          <SequenceBadge sequence={sequence} state={stopState} />
        ) : failed ? (
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
        ) : (
          <CircleCheck className="w-5 h-5 text-emerald-600 shrink-0" />
        )}
        <span className="flex-1 min-w-0 text-sm font-semibold text-gray-500 truncate">{stop.name}</span>
        {deliveryNote && (
          <StickyNote className="w-3.5 h-3.5 text-bakery-accent shrink-0" aria-label="Przystanek ma notatkę" />
        )}
        {photo && (
          <Camera className="w-3.5 h-3.5 text-bakery-accent shrink-0" aria-label="Przystanek ma zdjęcie dostawy" />
        )}
        {signature && (
          <Signature className="w-3.5 h-3.5 text-bakery-accent shrink-0" aria-label="Przystanek ma podpis odbiorcy" />
        )}
        {returnsSummary && returnsSummary.count > 0 && (
          <Undo2 className="w-3.5 h-3.5 text-bakery-accent shrink-0" aria-label="Przystanek ma zwroty towaru" />
        )}
        {failed ? (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-rose-700 whitespace-nowrap">
            <AlertTriangle className="w-3.5 h-3.5" /> Nieudana
            {failureReason && (
              <span className="hidden sm:inline font-semibold normal-case">
                · {FAILURE_REASON_LABELS[failureReason]}
              </span>
            )}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700 whitespace-nowrap">
            <CircleCheck className="w-3.5 h-3.5" /> Dostarczone
            {deliveredAt && <span className="font-semibold normal-case">{formatTime(deliveredAt)}</span>}
          </span>
        )}
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </button>
    );
  }

  return (
    <div
      className={`border rounded-lg p-3 flex flex-col gap-2 transition ${
        !hasDeliveryToday
          ? 'bg-bakery-rowBg/40 border-bakery-btnBorder border-dashed opacity-60'
          : isNext
            ? 'bg-bakery-rowBg border-bakery-accent ring-1 ring-bakery-accent shadow-sm'
            : 'bg-bakery-rowBg border-bakery-btnBorder shadow-xs hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          {sequence != null && <SequenceBadge sequence={sequence} state={stopState} />}
          <div className="min-w-0">
            <p className="font-bold text-sm text-bakery-dark m-0">{stop.name}</p>
            <p className="text-xs text-gray-500 font-semibold flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {stop.address}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {!hasDeliveryToday && (
            <span className="text-[10px] font-bold uppercase text-gray-400 italic whitespace-nowrap">
              Brak dostawy dzisiaj
            </span>
          )}
          {isNext && (
            <span className="px-2 py-0.5 rounded bg-bakery-accent text-black text-[10px] font-bold uppercase whitespace-nowrap">
              Następny
            </span>
          )}
          {handled && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-expanded
              className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-500 hover:text-bakery-dark whitespace-nowrap"
            >
              Zwiń <ChevronUp className="w-3.5 h-3.5" />
            </button>
          )}
          {(showCall || showNavigate) && (
            <div className="flex items-center gap-1.5">
              {showCall && (
                <a
                  href={`tel:${stop.phone}`}
                  aria-label={`Zadzwoń do: ${stop.name}`}
                  title={`Zadzwoń: ${stop.phone}`}
                  className={SECONDARY_ICON_BUTTON}
                >
                  <Phone className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-bakery-dark sm:text-bakery-accent" />
                  <span className="hidden sm:inline">Zadzwoń</span>
                </a>
              )}
              {showNavigate && (
                <a
                  href={buildGoogleMapsStopUrl(stop)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Nawiguj do: ${stop.name}`}
                  title="Nawiguj do klienta"
                  className={SECONDARY_ICON_BUTTON}
                >
                  <Navigation className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-bakery-dark sm:text-bakery-accent" />
                  <span className="hidden sm:inline">Nawiguj</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {hasDeliveryToday && (
        <div className="flex flex-col gap-1.5 mt-1">
          {stop.orders.map((order) => {
            const next = readOnly ? null : getDriverNextStep(order.status);
            const canReport = !readOnly && order.status === 'in_delivery';
            const busy = updatingId === order.do_id || isDeliveringStop;
            return (
              <div
                key={order.do_id}
                className="flex flex-col gap-2 bg-bakery-inactive border border-bakery-btnBorder rounded-lg px-3 py-2.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-sm font-semibold text-bakery-dark truncate">
                    {order.product_name} <span className="text-gray-500 font-mono">x{order.quantity}</span>
                  </span>
                </div>
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={order.status} />
                    {order.status === 'delivered' && order.delivered_at && (
                      <span className="text-[11px] text-gray-500 font-medium">o {formatTime(order.delivered_at)}</span>
                    )}
                    {order.status === 'failed' && order.failure_reason && (
                      <span className="text-[11px] text-rose-700 font-semibold">
                        {FAILURE_REASON_LABELS[order.failure_reason]}
                        {order.failed_at && ` · ${formatTime(order.failed_at)}`}
                      </span>
                    )}
                  </div>
                  {(next || canReport) && (
                    <div className="flex w-full sm:w-auto gap-2">
                      {canReport && (
                        <button
                          type="button"
                          onClick={() => openOrderProblem(order)}
                          disabled={busy}
                          aria-label={`Zgłoś problem: ${order.product_name}`}
                          title="Zgłoś problem z tą pozycją"
                          className={`${PROBLEM_BUTTON} w-11 h-11 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5`}
                        >
                          <AlertTriangle className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                          <span className="hidden sm:inline">Problem</span>
                        </button>
                      )}
                      {next && (
                        <button
                          onClick={() => onAdvance(order.do_id, next.status)}
                          disabled={busy}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center min-h-[44px] sm:min-h-0 px-4 sm:px-3.5 sm:py-1.5 text-xs font-bold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded-lg shadow-xs transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {updatingId === order.do_id ? '...' : next.label}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {order.status === 'failed' && order.failure_note && (
                  <p className="m-0 text-xs text-gray-600 italic">„{order.failure_note}”</p>
                )}
              </div>
            );
          })}
          {deliveryNote && (
            <div className="flex items-start justify-between gap-2 mt-1 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="m-0 flex items-start gap-1.5 text-xs text-bakery-dark min-w-0">
                <StickyNote className="w-3.5 h-3.5 text-bakery-accent shrink-0 mt-0.5" />
                <span className="italic break-words">„{deliveryNote}”</span>
              </p>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setNoteDialogOpen(true)}
                  className="shrink-0 min-h-[44px] sm:min-h-0 px-2 text-[11px] font-bold text-bakery-dark hover:underline"
                >
                  Edytuj
                </button>
              )}
            </div>
          )}
          {!deliveryNote && !readOnly && hasDeliveredOrders && (
            <button
              type="button"
              onClick={() => setNoteDialogOpen(true)}
              className="mt-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-0 sm:py-1.5 px-3 text-xs font-bold bg-white border border-bakery-btnBorder text-bakery-dark rounded-lg shadow-xs transition hover:bg-bakery-inactive active:scale-[0.98]"
            >
              <StickyNote className="w-3.5 h-3.5 text-bakery-accent" /> Dodaj notatkę do dostawy
            </button>
          )}
          {(photo || signature || canAddProof) && (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {photo && <ProofThumbnail proof={photo} stopName={stop.name} onOpen={setPreviewProof} />}
              {signature && <ProofThumbnail proof={signature} stopName={stop.name} onOpen={setPreviewProof} />}
              {canAddProof && (
                <>
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-0 sm:py-1.5 px-3 text-xs font-bold bg-white border border-bakery-btnBorder text-bakery-dark rounded-lg shadow-xs transition hover:bg-bakery-inactive active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Camera className="w-3.5 h-3.5 text-bakery-accent" />
                    {uploadingPhoto ? 'Wysyłanie...' : photo ? 'Zmień zdjęcie' : 'Zrób zdjęcie'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignatureDialogOpen(true)}
                    className="inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-0 sm:py-1.5 px-3 text-xs font-bold bg-white border border-bakery-btnBorder text-bakery-dark rounded-lg shadow-xs transition hover:bg-bakery-inactive active:scale-[0.98]"
                  >
                    <Signature className="w-3.5 h-3.5 text-bakery-accent" />
                    {signature ? 'Zmień podpis' : 'Podpis odbiorcy'}
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoSelected}
                    className="hidden"
                  />
                </>
              )}
            </div>
          )}
          {returnsSummary && returnsSummary.count > 0 ? (
            <div className="flex items-center justify-between gap-2 mt-1 bg-bakery-inactive border border-bakery-btnBorder rounded-lg px-3 py-2">
              <p className="m-0 flex items-center gap-1.5 text-xs text-bakery-dark min-w-0">
                <Undo2 className="w-3.5 h-3.5 text-bakery-accent shrink-0" />
                <span>
                  Zwroty: <strong>{returnsSummary.count} szt.</strong> · {formatMoney(returnsSummary.value)}
                </span>
              </p>
              {canRecordReturns && (
                <button
                  type="button"
                  onClick={() => setReturnsDialogOpen(true)}
                  className="shrink-0 min-h-[44px] sm:min-h-0 px-2 text-[11px] font-bold text-bakery-dark hover:underline"
                >
                  Edytuj
                </button>
              )}
            </div>
          ) : (
            canRecordReturns && (
              <button
                type="button"
                onClick={() => setReturnsDialogOpen(true)}
                className="mt-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-0 sm:py-1.5 px-3 text-xs font-bold bg-white border border-bakery-btnBorder text-bakery-dark rounded-lg shadow-xs transition hover:bg-bakery-inactive active:scale-[0.98]"
              >
                <Undo2 className="w-3.5 h-3.5 text-bakery-accent" /> Zwroty towaru
              </button>
            )
          )}
          {!readOnly && inDeliveryCount >= 2 && (
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => onDeliverStop(stop.client_id)}
                disabled={isDeliveringStop}
                className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-0 sm:py-2 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CircleCheck className="w-4 h-4" />
                {isDeliveringStop ? '...' : `Dostarcz wszystko (${inDeliveryCount})`}
              </button>
              <button
                type="button"
                onClick={openStopProblem}
                disabled={isDeliveringStop}
                className={`${PROBLEM_BUTTON} min-h-[44px] sm:min-h-0 sm:py-2 px-3`}
              >
                <AlertTriangle className="w-4 h-4" />
                <span className="hidden sm:inline">Problem z przystankiem</span>
                <span className="sm:hidden">Problem</span>
              </button>
            </div>
          )}
        </div>
      )}

      {problemDialog && (
        <ReportProblemDialog
          title={problemDialog.title}
          subtitle={problemDialog.subtitle}
          onSubmit={submitProblem}
          onClose={() => setProblemDialog(null)}
        />
      )}
      {noteDialogOpen && (
        <DeliveryNoteDialog
          subtitle={stop.name}
          initialNote={deliveryNote}
          onSubmit={submitDeliveryNote}
          onClose={() => setNoteDialogOpen(false)}
        />
      )}
      {previewProof && (
        <ProofPreviewDialog
          proof={previewProof}
          stopName={stop.name}
          canDelete={!readOnly}
          onDelete={deleteProof}
          onClose={() => setPreviewProof(null)}
        />
      )}
      {signatureDialogOpen && (
        <SignatureDialog
          subtitle={stop.name}
          onSubmit={submitSignature}
          onClose={() => setSignatureDialogOpen(false)}
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
