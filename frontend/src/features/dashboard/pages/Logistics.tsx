import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Eye, Lock, Truck } from 'lucide-react';
import {
  ApiError,
  fetchLogistics,
  type DeliveryProof,
  type FailureReason,
  type LogisticsData,
  type LogisticsOrder,
  type ReportProblemResult,
  type SaveReturnsResult,
  type StopReturns,
} from '../../../services/api';
import { StopCard } from '../components/StopCard';
import { DriverRouteView } from '../components/DriverRouteView';
import { ActionToast, type ActionToastData } from '../components/ActionToast';
import { type ProblemTarget } from '../components/ReportProblemDialog';
import { FAILURE_REASON_LABELS } from '../lib/logisticsStatus';
import { DateNav } from '../../orders/components/DateNav';
import { compressImage, ImageProcessingError } from '../lib/imageCompression';
import { applyReturnQuantities, type ReturnQuantities } from '../lib/returns';
import { isNetworkError, loadCached, saveCached } from '../../../services/offlineCache';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { OfflineBanner } from '../components/OfflineBanner';
import {
  createAction,
  enqueue,
  executeAction,
  loadQueue,
  removeFromQueue,
  syncQueue,
  clearFailed,
  dismissFailed,
  loadFailed,
  type FailedAction,
  type QueuedAction,
} from '../../../services/actionQueue';
import { FailedActionsPanel } from '../components/FailedActionsPanel';

const AUTO_REFRESH_MS = 60_000;
const PAGE = 'w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5 font-auth text-bakery-dark';
const TITLE = 'm-0 font-display text-[34px] leading-none font-extrabold tracking-[-0.02em]';
const CARD = 'rounded-[14px] border border-bakery-btnBorder bg-bakery-card shadow-sm';
const ALERT = 'm-0 px-4 py-3 rounded-xl bg-[#fbdcdc] text-sm font-semibold text-[#991b1b]';

function isStopDelivered(stop: { orders: LogisticsOrder[] }) {
  const active = stop.orders.filter((order) => order.status !== 'cancelled');
  return active.length > 0 && active.every((order) => order.status === 'delivered');
}

export default function Logistics() {
  const [data, setData] = useState<LogisticsData | null>(null);
  const [loadState, setLoadState] = useState<{ key: string; error: string | null } | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deliveringStopId, setDeliveringStopId] = useState<number | null>(null);
  const [previewDriverId, setPreviewDriverId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [toast, setToast] = useState<ActionToastData | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);
  const isOnline = useOnlineStatus();
  const mutationVersion = useRef(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedActions, setFailedActions] = useState<FailedAction[]>([]);
  const [syncing, setSyncing] = useState(false);
  const initialSyncDone = useRef(false);
  const requestKey = `${previewDriverId ?? 'self'}|${selectedDate ?? 'today'}`;
  const cacheKey = `logistics:${requestKey}`;
  const loading = loadState?.key !== requestKey;
  const error = loadState?.key === requestKey ? loadState.error : null;

  useEffect(() => {
    let cancelled = false;

    fetchLogistics(previewDriverId ?? undefined, selectedDate ?? undefined)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setLastUpdatedAt(new Date());
        setIsStale(false);
        setLoadState({ key: requestKey, error: null });
      })
      .catch(async (err: Error) => {
        const cached = isNetworkError(err) ? await loadCached<LogisticsData>(cacheKey) : null;
        if (cancelled) return;
        if (cached) {
          setData(cached.value);
          setLastUpdatedAt(new Date(cached.savedAt));
          setIsStale(true);
          setLoadState({ key: requestKey, error: null });
        } else {
          setLoadState({ key: requestKey, error: err.message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [previewDriverId, selectedDate, requestKey, cacheKey]);

  useEffect(() => {
    if (data && !loading) void saveCached(cacheKey, data, lastUpdatedAt ?? new Date());
  }, [data, loading, cacheKey, lastUpdatedAt]);

  useEffect(() => {
    loadQueue().then((queue) => setPendingCount(queue.length));
    loadFailed().then(setFailedActions);
  }, []);

  const allStops = data ? [...data.routes.flatMap((route) => route.stops), ...data.unassigned] : [];
  const findStop = (clientId: number) => allStops.find((stop) => stop.client_id === clientId) ?? null;
  const findOrder = (orderId: number) => {
    for (const stop of allStops) {
      const order = stop.orders.find((o) => o.do_id === orderId);
      if (order) return { stop, order };
    }
    return null;
  };
  const stopOrderIds = (clientId: number, status: LogisticsOrder['status']) =>
    findStop(clientId)
      ?.orders.filter((o) => o.status === status)
      .map((o) => o.do_id) ?? [];
  const orderLabel = (orderId: number, text: string) => {
    const found = findOrder(orderId);
    return found
      ? `${found.stop.name}: ${found.order.product_name} x${found.order.quantity} – ${text}`
      : `Zamówienie #${orderId} – ${text}`;
  };
  const stopLabel = (clientId: number, text: string) =>
    `${findStop(clientId)?.name ?? `Klient #${clientId}`} – ${text}`;

  const patchOrders = (orderIds: number[], patch: Partial<LogisticsOrder>) => {
    const ids = new Set(orderIds);
    setData((prev) => {
      if (!prev) return prev;
      const patchStop = (stop: (typeof prev.unassigned)[number]) => ({
        ...stop,
        orders: stop.orders.map((o) => (ids.has(o.do_id) ? { ...o, ...patch } : o)),
      });
      return {
        ...prev,
        routes: prev.routes.map((route) => ({ ...route, stops: route.stops.map(patchStop) })),
        unassigned: prev.unassigned.map(patchStop),
      };
    });
  };

  const applyOrderStatus = (orderIds: number[], status: LogisticsOrder['status'], deliveredAt: string | null = null) =>
    patchOrders(orderIds, {
      status,
      delivered_at: status === 'delivered' ? deliveredAt : null,
      delivery_note: '',
      failure_reason: '',
      failure_note: '',
      failed_at: null,
    });

  const applyFailure = (orderIds: number[], reason: FailureReason, note: string, failedAt: string) =>
    patchOrders(orderIds, {
      status: 'failed',
      delivered_at: null,
      failure_reason: reason,
      failure_note: note,
      failed_at: failedAt,
    });

  const showActionError = (err: unknown) => {
    if (err instanceof ApiError) {
      setToast({
        text:
          err.status === 404
            ? 'Dane zostały w międzyczasie zmienione lub usunięte. Odśwież, aby zobaczyć aktualny stan.'
            : err.message,
        canRefresh: [400, 403, 404].includes(err.status),
      });
    } else {
      setToast({
        text: 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.',
        canRefresh: false,
      });
    }
  };

  type RunOutcome<T> = { status: 'sent'; result: T } | { status: 'queued' } | { status: 'error' };

  const queueAction = async (action: QueuedAction, applyLocally: () => void): Promise<RunOutcome<never>> => {
    try {
      await enqueue(action);
    } catch (err) {
      console.error('Nie udało się zapisać akcji w telefonie:', err);
      setToast({
        text: 'Brak połączenia i nie udało się zapisać akcji w telefonie. Spróbuj ponownie.',
        canRefresh: false,
      });
      return { status: 'error' };
    }
    mutationVersion.current += 1;
    applyLocally();
    setPendingCount((count) => count + 1);
    return { status: 'queued' };
  };

  const runAction = async <T,>(action: QueuedAction, applyLocally: () => void): Promise<RunOutcome<T>> => {
    if (!navigator.onLine) return queueAction(action, applyLocally);
    try {
      const result = (await executeAction(action)) as T;
      mutationVersion.current += 1;
      return { status: 'sent', result };
    } catch (err) {
      if (isNetworkError(err)) return queueAction(action, applyLocally);
      console.error(`Błąd akcji „${action.label}”:`, err);
      showActionError(err);
      return { status: 'error' };
    }
  };

  const withdrawQueued = async (queuedActionId: string | null) => {
    if (!queuedActionId || !(await removeFromQueue(queuedActionId))) return false;
    mutationVersion.current += 1;
    setPendingCount((count) => Math.max(0, count - 1));
    return true;
  };

  const undoDelivery = async (orderIds: number[], queuedActionId: string | null) => {
    setToast(null);
    if (await withdrawQueued(queuedActionId)) {
      applyOrderStatus(orderIds, 'in_delivery');
      return;
    }
    for (const orderId of orderIds) {
      const action = createAction({
        type: 'status',
        payload: { orderId, status: 'in_delivery' },
        label: orderLabel(orderId, 'cofnięcie dostawy'),
      });
      const outcome = await runAction(action, () => applyOrderStatus([orderId], 'in_delivery'));
      if (outcome.status === 'error') break;
      if (outcome.status === 'sent') applyOrderStatus([orderId], 'in_delivery');
    }
  };

  const undoProblem = async (orderIds: number[], queuedActionId: string | null) => {
    setToast(null);
    if (await withdrawQueued(queuedActionId)) {
      applyOrderStatus(orderIds, 'in_delivery');
      return;
    }
    const action = createAction({
      type: 'withdrawProblem',
      payload: { orderIds },
      label: orderLabel(orderIds[0], 'wycofanie zgłoszenia problemu'),
    });
    const outcome = await runAction<{ reverted_ids: number[] }>(action, () =>
      applyOrderStatus(orderIds, 'in_delivery')
    );
    if (outcome.status === 'error') return;
    if (outcome.status === 'sent') applyOrderStatus(outcome.result.reverted_ids, 'in_delivery');
    setToast({
      variant: 'success',
      text:
        outcome.status === 'queued'
          ? 'Zgłoszenie wycofane (zapisano w telefonie).'
          : 'Zgłoszenie wycofane. Biuro zostało powiadomione.',
    });
  };

  const handleAdvance = async (orderId: number, nextStatus: LogisticsOrder['status']) => {
    const action = createAction({
      type: 'status',
      payload: { orderId, status: nextStatus },
      label: orderLabel(orderId, nextStatus === 'delivered' ? 'dostarczono' : 'zmiana statusu'),
    });
    setUpdatingId(orderId);
    const outcome = await runAction<{ delivered_at: string | null }>(action, () =>
      applyOrderStatus([orderId], nextStatus, action.occurredAt)
    );
    setUpdatingId(null);
    if (outcome.status === 'error') return;
    if (outcome.status === 'sent') applyOrderStatus([orderId], nextStatus, outcome.result.delivered_at);
    if (nextStatus === 'delivered') {
      const queued = outcome.status === 'queued';
      setToast({
        variant: 'success',
        text: queued ? 'Oznaczono jako dostarczone (zapisano w telefonie).' : 'Oznaczono jako dostarczone.',
        onUndo: () => undoDelivery([orderId], queued ? action.id : null),
      });
    }
  };

  const handleDeliverStop = async (clientId: number) => {
    const localIds = stopOrderIds(clientId, 'in_delivery');
    const action = createAction({
      type: 'deliverStop',
      payload: { clientId },
      label: stopLabel(clientId, 'dostarczono wszystko'),
    });
    setDeliveringStopId(clientId);
    const outcome = await runAction<{ delivered_ids: number[]; delivered_at: string }>(action, () =>
      applyOrderStatus(localIds, 'delivered', action.occurredAt)
    );
    setDeliveringStopId(null);
    if (outcome.status === 'error') return;
    const deliveredIds = outcome.status === 'sent' ? outcome.result.delivered_ids : localIds;
    if (outcome.status === 'sent') applyOrderStatus(deliveredIds, 'delivered', outcome.result.delivered_at);
    const queued = outcome.status === 'queued';
    setToast({
      variant: 'success',
      text: `Przystanek oznaczony jako dostarczony (${deliveredIds.length} poz.)${queued ? ' – zapisano w telefonie' : ''}.`,
      onUndo: () => undoDelivery(deliveredIds, queued ? action.id : null),
    });
  };

  const handleReportProblem = async (target: ProblemTarget, reason: FailureReason, note: string): Promise<boolean> => {
    const localIds = target.kind === 'stop' ? stopOrderIds(target.clientId, 'in_delivery') : [target.orderId];
    const action =
      target.kind === 'stop'
        ? createAction({
            type: 'reportStopProblem',
            payload: { clientId: target.clientId, reason, note },
            label: stopLabel(target.clientId, `problem: ${FAILURE_REASON_LABELS[reason]}`),
          })
        : createAction({
            type: 'reportOrderProblem',
            payload: { orderId: target.orderId, reason, note },
            label: orderLabel(target.orderId, `problem: ${FAILURE_REASON_LABELS[reason]}`),
          });
    const outcome = await runAction<ReportProblemResult>(action, () =>
      applyFailure(localIds, reason, note, action.occurredAt)
    );
    if (outcome.status === 'error') return false;
    const failedIds = outcome.status === 'sent' ? outcome.result.failed_ids : localIds;
    if (outcome.status === 'sent') {
      applyFailure(failedIds, outcome.result.failure_reason, outcome.result.failure_note, outcome.result.failed_at);
    }
    const queued = outcome.status === 'queued';
    setToast({
      variant: 'success',
      text: queued
        ? `Zgłoszono problem: ${FAILURE_REASON_LABELS[reason]}. Zapisano w telefonie – biuro dostanie powiadomienie po odzyskaniu zasięgu.`
        : `Zgłoszono problem: ${FAILURE_REASON_LABELS[reason]}. Biuro zostało powiadomione.`,
      onUndo: () => undoProblem(failedIds, queued ? action.id : null),
    });
    return true;
  };

  const handleSaveDeliveryNote = async (clientId: number, note: string): Promise<boolean> => {
    const localIds = stopOrderIds(clientId, 'delivered');
    const action = createAction({
      type: 'deliveryNote',
      payload: { clientId, note },
      label: stopLabel(clientId, note ? 'notatka do dostawy' : 'usunięcie notatki'),
    });
    const outcome = await runAction<{ updated_ids: number[]; delivery_note: string }>(action, () =>
      patchOrders(localIds, { delivery_note: note.trim() })
    );
    if (outcome.status === 'error') return false;
    if (outcome.status === 'sent') {
      patchOrders(outcome.result.updated_ids, { delivery_note: outcome.result.delivery_note });
    }
    const saved = note.trim() ? 'Notatka zapisana' : 'Notatka usunięta';
    setToast({ variant: 'success', text: outcome.status === 'queued' ? `${saved} (w telefonie).` : `${saved}.` });
    return true;
  };

  const patchStopReturns = (clientId: number, returns: StopReturns | null) => {
    setData((prev) => {
      if (!prev) return prev;
      const patchStop = (stop: (typeof prev.unassigned)[number]) =>
        stop.client_id === clientId ? { ...stop, returns } : stop;
      return {
        ...prev,
        routes: prev.routes.map((route) => ({ ...route, stops: route.stops.map(patchStop) })),
        unassigned: prev.unassigned.map(patchStop),
      };
    });
  };

  const handleSaveReturns = async (clientId: number, quantities: ReturnQuantities): Promise<boolean> => {
    const current = findStop(clientId)?.returns;
    if (!current) return false;
    const items = current.items.map((item) => ({
      product_id: item.product_id,
      quantity: quantities[item.product_id] ?? 0,
    }));
    const action = createAction({
      type: 'saveReturns',
      payload: { clientId, items, date: data?.date },
      label: stopLabel(clientId, 'zwroty towaru'),
    });
    const outcome = await runAction<SaveReturnsResult>(action, () =>
      patchStopReturns(clientId, applyReturnQuantities(current, quantities))
    );
    if (outcome.status === 'error') return false;
    if (outcome.status === 'sent') patchStopReturns(clientId, outcome.result.returns);
    setToast({
      variant: 'success',
      text:
        outcome.status === 'queued'
          ? 'Zwroty zapisane w telefonie – wyślemy po odzyskaniu zasięgu.'
          : 'Zwroty zapisane.',
    });
    return true;
  };

  const patchStopProofs = (clientId: number, update: (proofs: DeliveryProof[]) => DeliveryProof[]) => {
    setData((prev) => {
      if (!prev) return prev;
      const patchStop = (stop: (typeof prev.unassigned)[number]) =>
        stop.client_id === clientId ? { ...stop, proofs: update(stop.proofs) } : stop;
      return {
        ...prev,
        routes: prev.routes.map((route) => ({ ...route, stops: route.stops.map(patchStop) })),
        unassigned: prev.unassigned.map(patchStop),
      };
    });
  };

  const replaceProof = (clientId: number, proof: DeliveryProof) =>
    patchStopProofs(clientId, (proofs) =>
      [...proofs.filter((p) => p.kind !== proof.kind), proof].sort((a, b) => a.kind.localeCompare(b.kind))
    );

  const removeProof = (clientId: number, proofId: number) =>
    patchStopProofs(clientId, (proofs) => proofs.filter((p) => p.proof_id !== proofId));

  const handleUploadProof = async (
    clientId: number,
    kind: DeliveryProof['kind'],
    image: Blob,
    signerName = ''
  ): Promise<boolean> => {
    let payload: Blob;
    try {
      payload = kind === 'photo' ? await compressImage(image) : image;
    } catch (err) {
      console.error('Błąd podczas przetwarzania zdjęcia:', err);
      setToast({
        text: err instanceof ImageProcessingError ? err.message : 'Nie udało się przetworzyć zdjęcia.',
        canRefresh: false,
      });
      return false;
    }

    const kindLabel = kind === 'photo' ? 'zdjęcie dostawy' : 'podpis odbiorcy';
    const action = createAction({
      type: 'uploadProof',
      payload: { clientId, kind, image: payload, signerName },
      label: stopLabel(clientId, kindLabel),
    });
    const localProof: DeliveryProof = {
      proof_id: -Date.now(),
      kind,
      signer_name: kind === 'signature' ? signerName.trim() : '',
      created_at: action.occurredAt,
      localImage: payload,
      pendingActionId: action.id,
    };

    const outcome = await runAction<DeliveryProof>(action, () => replaceProof(clientId, localProof));
    if (outcome.status === 'error') return false;
    if (outcome.status === 'sent') replaceProof(clientId, outcome.result);
    const saved = kind === 'photo' ? 'Zdjęcie zapisane' : 'Podpis zapisany';
    setToast({
      variant: 'success',
      text: outcome.status === 'queued' ? `${saved} w telefonie – wyślemy po odzyskaniu zasięgu.` : `${saved}.`,
    });
    return true;
  };

  const handleDeleteProof = async (clientId: number, proofId: number): Promise<boolean> => {
    const proof = findStop(clientId)?.proofs.find((p) => p.proof_id === proofId);
    if (proof?.pendingActionId && (await withdrawQueued(proof.pendingActionId))) {
      removeProof(clientId, proofId);
      setToast({ variant: 'success', text: 'Potwierdzenie usunięte (nie zostało jeszcze wysłane).' });
      return true;
    }

    const action = createAction({
      type: 'deleteProof',
      payload: { clientId, proofId },
      label: stopLabel(clientId, 'usunięcie potwierdzenia'),
    });
    const outcome = await runAction(action, () => removeProof(clientId, proofId));
    if (outcome.status === 'error') return false;
    if (outcome.status === 'sent') removeProof(clientId, proofId);
    setToast({
      variant: 'success',
      text: outcome.status === 'queued' ? 'Potwierdzenie usunięte (w telefonie).' : 'Potwierdzenie usunięte.',
    });
    return true;
  };

  const refreshData = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      const versionAtStart = mutationVersion.current;
      if (!silent) {
        setToast(null);
        setRefreshing(true);
      }
      try {
        const result = await fetchLogistics(previewDriverId ?? undefined, selectedDate ?? undefined);
        if (mutationVersion.current !== versionAtStart) return;
        if ((await loadQueue()).length > 0) return;
        setData(result);
        setLoadState({ key: requestKey, error: null });
        setLastUpdatedAt(new Date());
        setIsStale(false);
      } catch (err) {
        if (isNetworkError(err)) setIsStale(true);
        if (!silent) {
          setToast({ text: 'Nie udało się odświeżyć danych. Spróbuj ponownie.', canRefresh: true });
        }
      } finally {
        if (!silent) setRefreshing(false);
      }
    },
    [previewDriverId, selectedDate, requestKey]
  );

  const syncPending = useCallback(async () => {
    const result = await syncQueue();
    if (result.sent > 0 || result.failed > 0) mutationVersion.current += 1;
    setPendingCount(result.pending);
    if (result.failed > 0) {
      setFailedActions(await loadFailed());
      setToast({
        text: `Nie udało się wysłać ${result.failed} akcji – szczegóły na górze ekranu.`,
        canRefresh: true,
      });
    }
    return result;
  }, []);

  const handleSyncNow = async () => {
    setSyncing(true);
    const result = await syncPending();
    setSyncing(false);
    if (result.sent > 0 || result.failed > 0) void refreshData({ silent: true });
    if (result.pending > 0 && result.failed === 0) {
      setToast({ text: 'Nie udało się połączyć z serwerem. Spróbujemy ponownie automatycznie.', canRefresh: false });
    }
  };

  const handleDismissFailed = async (actionId: string) => {
    await dismissFailed(actionId);
    setFailedActions((actions) => actions.filter((action) => action.id !== actionId));
  };

  const handleDismissAllFailed = async () => {
    await clearFailed();
    setFailedActions([]);
  };

  useEffect(() => {
    const syncAndRefresh = async () => {
      if (document.visibilityState !== 'visible') return;
      if (navigator.onLine) await syncPending();
      void refreshData({ silent: true });
    };

    if (!initialSyncDone.current) {
      initialSyncDone.current = true;
      void syncAndRefresh();
    }

    const intervalId = setInterval(syncAndRefresh, AUTO_REFRESH_MS);
    document.addEventListener('visibilitychange', syncAndRefresh);
    window.addEventListener('online', syncAndRefresh);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', syncAndRefresh);
      window.removeEventListener('online', syncAndRefresh);
    };
  }, [refreshData, syncPending]);

  if (loading) {
    return (
      <div className={PAGE}>
        <h1 className={TITLE}>Logistyka i trasy</h1>
        <div
          aria-label="Wczytywanie tras"
          className="h-[420px] rounded-[14px] border border-bakery-btnBorder bg-bakery-inactive animate-pulse"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className={PAGE}>
        <h1 className={TITLE}>Logistyka i trasy</h1>
        <p role="alert" className={ALERT}>
          Błąd połączenia z serwerem: {error}
        </p>
      </div>
    );
  }

  if (!data) return null;

  if (data.viewer.role === 'driver' || data.viewer.is_preview) {
    const previewDriverName = data.viewer.is_preview
      ? data.drivers.find((d) => d.user_id === data.viewer.driver_id)?.full_name
      : undefined;

    return (
      <div className="w-full max-w-7xl mx-auto px-0 py-0 sm:px-8 sm:py-6">
        {(!isOnline || isStale || pendingCount > 0 || failedActions.length > 0) && (
          <div className="max-w-3xl mx-auto mb-4 flex flex-col gap-2">
            {(!isOnline || isStale || pendingCount > 0) && (
              <OfflineBanner
                isOnline={isOnline}
                savedAt={isStale ? lastUpdatedAt : null}
                pendingCount={pendingCount}
                syncing={syncing}
                onSyncNow={handleSyncNow}
              />
            )}
            <FailedActionsPanel
              actions={failedActions}
              onDismiss={handleDismissFailed}
              onDismissAll={handleDismissAllFailed}
            />
          </div>
        )}
        <DriverRouteView
          date={data.date}
          today={data.today}
          onChangeDate={setSelectedDate}
          routes={data.routes}
          onAdvance={handleAdvance}
          updatingId={updatingId}
          onDeliverStop={handleDeliverStop}
          deliveringStopId={deliveringStopId}
          onRefresh={() => refreshData()}
          refreshing={refreshing}
          lastUpdatedAt={lastUpdatedAt}
          previewDriverName={previewDriverName}
          onExitPreview={() => setPreviewDriverId(null)}
          onReportProblem={handleReportProblem}
          onSaveDeliveryNote={handleSaveDeliveryNote}
          onSaveReturns={handleSaveReturns}
          onUploadProof={handleUploadProof}
          onDeleteProof={handleDeleteProof}
        />
        <ActionToast toast={toast} onClose={closeToast} onRefresh={() => refreshData()} />
      </div>
    );
  }

  const routes = data.routes;
  const unassigned = data.unassigned;
  const isHistory = data.date !== data.today;
  const activeStops = [...routes.flatMap((route) => route.stops), ...unassigned].filter(
    (stop) => stop.orders.length > 0
  );
  const problemStops = [
    ...routes.flatMap((route) => route.stops.map((stop) => ({ stop, routeName: route.route_name }))),
    ...unassigned.map((stop) => ({ stop, routeName: 'Bez trasy' })),
  ].filter(({ stop }) => stop.orders.some((o) => o.status === 'failed'));
  const tiles = [
    { label: 'Przystanki', value: activeStops.length, hint: `na ${routes.length} trasach`, color: '' },
    {
      label: 'Dostarczone',
      value: activeStops.filter(isStopDelivered).length,
      hint: 'przystanków',
      color: 'text-[#1f5f33]',
    },
    {
      label: 'W trasie',
      value: activeStops.filter((stop) => stop.orders.some((o) => o.status === 'in_delivery')).length,
      hint: 'przystanków',
      color: 'text-[#1d4f91]',
    },
    { label: 'Problemy', value: problemStops.length, hint: 'nieudane dostawy', color: 'text-[#b91c1c]' },
  ];

  return (
    <div className={PAGE}>
      {(!isOnline || isStale || pendingCount > 0) && (
        <OfflineBanner
          isOnline={isOnline}
          savedAt={isStale ? lastUpdatedAt : null}
          pendingCount={pendingCount}
          syncing={syncing}
          onSyncNow={handleSyncNow}
        />
      )}
      <FailedActionsPanel
        actions={failedActions}
        onDismiss={handleDismissFailed}
        onDismissAll={handleDismissAllFailed}
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className={TITLE}>Logistyka i trasy</h1>
          <p className="m-0 text-sm text-[#4a4543]">Przebieg dostaw na trasach – statusy, potwierdzenia i zwroty.</p>
        </div>
        {data.drivers.length > 0 && (
          <label className="flex items-center gap-2 text-[13px] font-extrabold text-[#3d3937]">
            <Eye aria-hidden className="w-4 h-4" />
            Podgląd jako kierowca
            <select
              defaultValue=""
              onChange={(e) => setPreviewDriverId(e.target.value ? Number(e.target.value) : null)}
              className="h-11 px-3 rounded-xl border-[1.5px] border-bakery-btnBorder bg-white text-[14px] font-bold outline-none focus:border-bakery-accent"
            >
              <option value="" disabled>
                Wybierz kierowcę…
              </option>
              {data.drivers.map((d) => (
                <option key={d.user_id} value={d.user_id}>
                  {d.full_name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <DateNav
        date={data.date}
        today={data.today}
        max={data.today}
        onChange={(next) => setSelectedDate(next >= data.today ? null : next)}
      />

      {isHistory && (
        <p className="m-0 flex items-center gap-2.5 px-4 py-3 rounded-[14px] bg-[#e6e1df] text-sm font-bold text-[#3d3937]">
          <Lock aria-hidden className="w-5 h-5 shrink-0" />
          Miniony dzień – podgląd tylko do odczytu, statusów nie można zmieniać.
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((tile) => (
          <div key={tile.label} className={`${CARD} px-4 py-3.5 flex flex-col gap-1.5`}>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]">{tile.label}</span>
            <span className={`font-display text-[26px] leading-none font-extrabold tabular-nums ${tile.color}`}>
              {tile.value}
            </span>
            <span className="text-xs font-bold text-[#5f5a58]">{tile.hint}</span>
          </div>
        ))}
      </div>

      {problemStops.length > 0 && (
        <div className="flex flex-col gap-1.5 px-4 py-3 rounded-[14px] bg-[#fbdcdc] text-[#7f1d1d]">
          <p className="m-0 flex items-center gap-2 text-sm font-extrabold">
            <AlertTriangle aria-hidden className="w-5 h-5" /> Nieudane dostawy ({problemStops.length})
          </p>
          <ul className="m-0 pl-7 list-none flex flex-col gap-0.5 text-[13px] font-semibold">
            {problemStops.map(({ stop, routeName }) => {
              const failedOrder = stop.orders.find((o) => o.status === 'failed');
              return (
                <li key={stop.client_id}>
                  <span className="font-extrabold">{stop.name}</span> · {routeName}
                  {failedOrder?.failure_reason && ` · ${FAILURE_REASON_LABELS[failedOrder.failure_reason]}`}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {routes.length === 0 && unassigned.length === 0 ? (
        <p className={`${CARD} m-0 px-5 py-8 text-center text-sm font-semibold text-[#5f5a58]`}>
          Brak skonfigurowanych aktywnych tras.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {routes.map((route) => {
            const withOrders = route.stops.filter((stop) => stop.orders.length > 0);
            const idle = route.stops.filter((stop) => stop.orders.length === 0);
            const done = withOrders.filter(isStopDelivered).length;
            return (
              <section key={route.route_id} className={`${CARD} overflow-hidden flex flex-col`}>
                <header className="px-4 py-3 bg-bakery-dark text-white flex flex-wrap items-center justify-between gap-2">
                  <span className="flex flex-col gap-0.5">
                    <span className="inline-flex items-center gap-2 text-[15px] font-extrabold">
                      <Truck aria-hidden className="w-4 h-4 text-bakery-accent" />
                      {route.route_name}
                    </span>
                    <span className="text-xs font-bold text-[#cfc9c7]">
                      {route.driver ? route.driver.full_name : 'Brak kierowcy'} · {done}/{withOrders.length} dostarczone
                    </span>
                  </span>
                  {route.driver && (
                    <button
                      type="button"
                      onClick={() => setPreviewDriverId(route.driver!.user_id)}
                      className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-[10px] bg-bakery-accent text-bakery-dark text-[12px] font-extrabold hover:brightness-95"
                    >
                      <Eye aria-hidden className="w-4 h-4" /> Widok kierowcy
                    </button>
                  )}
                </header>
                {withOrders.length > 0 && (
                  <span aria-hidden className="h-1.5 bg-[#e6e1df]">
                    <span
                      className="block h-full bg-[#2e8b4e]"
                      style={{ width: `${(done / withOrders.length) * 100}%` }}
                    />
                  </span>
                )}
                <div className="p-3 flex flex-col gap-2.5">
                  {withOrders.length === 0 ? (
                    <p className="m-0 py-5 text-center text-[13px] font-semibold text-[#5f5a58]">
                      Brak dostaw na tej trasie w tym dniu.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                      {withOrders.map((stop) => (
                        <StopCard
                          key={stop.client_id}
                          stop={stop}
                          onAdvance={handleAdvance}
                          updatingId={updatingId}
                          readOnly={isHistory}
                          onDeleteProof={handleDeleteProof}
                          onSaveReturns={handleSaveReturns}
                        />
                      ))}
                    </div>
                  )}
                  {idle.length > 0 && (
                    <p className="m-0 px-1 text-[12px] font-semibold text-[#8a8482]">
                      Bez dostawy: {idle.map((stop) => stop.name).join(', ')}
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {unassigned.length > 0 && (
        <section className={`${CARD} overflow-hidden`}>
          <header className="px-4 py-3 bg-[#fbe5bd] flex items-center gap-2 text-sm font-extrabold text-[#5c3300]">
            <AlertTriangle aria-hidden className="w-4 h-4" />
            Klienci bez przypisanej trasy ({unassigned.length})
          </header>
          <div className="p-3 grid grid-cols-1 xl:grid-cols-2 gap-2.5">
            {unassigned.map((stop) => (
              <StopCard
                key={stop.client_id}
                stop={stop}
                onAdvance={handleAdvance}
                updatingId={updatingId}
                readOnly={isHistory}
                onDeleteProof={handleDeleteProof}
                onSaveReturns={handleSaveReturns}
              />
            ))}
          </div>
        </section>
      )}
      <ActionToast toast={toast} onClose={closeToast} onRefresh={() => refreshData()} />
    </div>
  );
}