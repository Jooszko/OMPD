import { useCallback, useEffect, useRef, useState } from 'react';
import { Truck, User, AlertTriangle, Eye, Inbox } from 'lucide-react';
import {
  ApiError,
  fetchLogistics,
  type DeliveryProof,
  type FailureReason,
  type LogisticsData,
  type LogisticsOrder,
  type ReportProblemResult,
} from '../../../services/api';
import { StopCard } from '../components/StopCard';
import { DriverRouteView } from '../components/DriverRouteView';
import { ActionToast, type ActionToastData } from '../components/ActionToast';
import { type ProblemTarget } from '../components/ReportProblemDialog';
import { FAILURE_REASON_LABELS } from '../lib/logisticsStatus';
import { DayNavigator, HistoryNotice } from '../components/DayNavigator';
import { formatDayLabel } from '../lib/dateFormat';
import { compressImage, ImageProcessingError } from '../lib/imageCompression';
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

  // --- Kopia danych w telefonie: zapis po każdej zmianie, także offline ---
  useEffect(() => {
    if (data && !loading) void saveCached(cacheKey, data, lastUpdatedAt ?? new Date());
  }, [data, loading, cacheKey, lastUpdatedAt]);

  useEffect(() => {
    loadQueue().then((queue) => setPendingCount(queue.length));
    loadFailed().then(setFailedActions);
  }, []);

  // --- Wyszukiwanie przystanków i zamówień w aktualnych danych ---
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

  // --- Zmiany na ekranie ---
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
      <div className="w-full max-w-7xl mx-auto px-0 py-0 sm:px-8 sm:py-6 text-bakery-dark">
        <h1 className="text-2xl font-bold mb-2">Logistyka i Trasy</h1>
        <p>Ładowanie danych...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-7xl mx-auto px-0 py-0 sm:px-8 sm:py-6 text-bakery-dark">
        <h1 className="text-2xl font-bold mb-2">Logistyka i Trasy</h1>
        <p className="text-red-600">Błąd połączenia z serwerem: {error}</p>
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
  const deliveriesToday =
    routes.reduce((sum, r) => sum + r.stops.filter((s) => s.orders.length > 0).length, 0) + unassigned.length;
  const problemStops = [
    ...routes.flatMap((route) => route.stops.map((stop) => ({ stop, routeName: route.route_name }))),
    ...unassigned.map((stop) => ({ stop, routeName: 'Bez trasy' })),
  ].filter(({ stop }) => stop.orders.some((o) => o.status === 'failed'));

  return (
    <div className="w-full max-w-7xl mx-auto px-8 py-6 flex flex-col gap-5 text-bakery-dark">
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="m-0 mb-1 text-2xl font-bold tracking-tight text-bakery-dark">Logistyka i Trasy</h1>
          <p className="text-xs text-gray-500 font-medium first-letter:uppercase">
            {isHistory ? 'Historia dostaw' : 'Plan dostaw na dziś'}: {formatDayLabel(data.date)} — {deliveriesToday}{' '}
            {deliveriesToday === 1 ? 'dostawa' : 'dostaw(y)'} w {routes.length}{' '}
            {routes.length === 1 ? 'trasie' : 'trasach'}.
          </p>
          <div className="mt-2 flex flex-col gap-2">
            <DayNavigator date={data.date} today={data.today} onChangeDate={setSelectedDate} />
            {isHistory && <HistoryNotice />}
          </div>
        </div>

        {data.drivers.length > 0 && (
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
            <Eye className="w-4 h-4" />
            Podgląd jako kierowca:
            <select
              defaultValue=""
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                setPreviewDriverId(id);
              }}
              className="bg-white border border-bakery-btnBorder rounded px-2 py-1 text-xs cursor-pointer outline-none focus:border-bakery-accent"
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

      <hr className="border-0 border-t border-bakery-border my-1" />

      {problemStops.length > 0 && (
        <div className="bg-rose-50 border border-rose-300 rounded-xl p-3.5 flex flex-col gap-2">
          <p className="m-0 flex items-center gap-2 text-sm font-bold text-rose-800">
            <AlertTriangle className="w-4 h-4 text-rose-600" /> Problemy z dostawą ({problemStops.length})
          </p>
          <ul className="m-0 p-0 list-none flex flex-col gap-1">
            {problemStops.map(({ stop, routeName }) => {
              const failedOrder = stop.orders.find((o) => o.status === 'failed');
              return (
                <li key={stop.client_id} className="text-xs text-rose-900">
                  <span className="font-bold">{stop.name}</span> · {routeName}
                  {failedOrder?.failure_reason && ` · ${FAILURE_REASON_LABELS[failedOrder.failure_reason]}`}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {routes.length === 0 && unassigned.length === 0 ? (
        <div className="bg-bakery-inactive rounded-xl border border-bakery-btnBorder shadow-sm p-8 flex flex-col items-center gap-2 text-center text-gray-500 text-sm font-semibold italic">
          <Truck className="w-6 h-6 text-gray-400" />
          Brak skonfigurowanych aktywnych tras.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {routes.map((route) => (
            <div
              key={route.route_id}
              className="bg-bakery-inactive rounded-xl border border-bakery-btnBorder shadow-md flex flex-col overflow-hidden"
            >
              <div className="bg-bakery-dark text-white p-3.5 flex items-center justify-between gap-2 shrink-0">
                <span className="text-sm font-bold flex items-center gap-2">
                  <Truck className="w-4 h-4 text-bakery-accent" /> {route.route_name}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold flex items-center gap-1.5 text-gray-300">
                    <User className="w-3.5 h-3.5" />
                    {route.driver ? route.driver.full_name : 'Brak kierowcy'}
                  </span>
                  {route.driver && (
                    <button
                      onClick={() => setPreviewDriverId(route.driver!.user_id)}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold bg-bakery-accent text-black rounded-lg shadow-xs transition active:scale-[0.98]"
                    >
                      <Eye className="w-3 h-3" /> Podgląd
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3 flex flex-col gap-2">
                {route.stops.length === 0 ? (
                  <div className="flex flex-col items-center gap-1.5 text-gray-500 text-xs font-semibold italic text-center py-6">
                    <Inbox className="w-5 h-5 text-gray-400" />
                    Brak dostaw na tej trasie dzisiaj.
                  </div>
                ) : (
                  route.stops.map((stop) => (
                    <StopCard
                      key={stop.client_id}
                      stop={stop}
                      onAdvance={handleAdvance}
                      updatingId={updatingId}
                      readOnly={isHistory}
                      onDeleteProof={handleDeleteProof}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {unassigned.length > 0 && (
        <div className="bg-bakery-inactive rounded-xl border border-amber-400 shadow-md overflow-hidden">
          <div className="bg-amber-50 border-b border-amber-300 p-3.5 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-bold text-amber-800">
              Klienci bez przypisanej trasy ({unassigned.length})
            </span>
          </div>
          <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {unassigned.map((stop) => (
              <StopCard
                key={stop.client_id}
                stop={stop}
                onAdvance={handleAdvance}
                updatingId={updatingId}
                readOnly={isHistory}
                onDeleteProof={handleDeleteProof}
              />
            ))}
          </div>
        </div>
      )}
      <ActionToast toast={toast} onClose={closeToast} onRefresh={() => refreshData()} />
    </div>
  );
}
