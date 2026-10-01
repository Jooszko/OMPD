import { useCallback, useEffect, useRef, useState } from 'react';
import { Truck, User, AlertTriangle, Eye, Inbox } from 'lucide-react';
import {
  ApiError,
  deliverStop,
  fetchLogistics,
  reportOrderProblem,
  reportStopProblem,
  updateOrderStatus,
  withdrawProblemReport,
  type FailureReason,
  type LogisticsData,
  type LogisticsOrder,
} from '../../../services/api';
import { StopCard } from '../components/StopCard';
import { DriverRouteView } from '../components/DriverRouteView';
import { ActionToast, type ActionToastData } from '../components/ActionToast';
import { type ProblemTarget } from '../components/ReportProblemDialog';
import { FAILURE_REASON_LABELS } from '../lib/logisticsStatus';

const AUTO_REFRESH_MS = 60_000;

export default function Logistics() {
  const [data, setData] = useState<LogisticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deliveringStopId, setDeliveringStopId] = useState<number | null>(null);
  const [previewDriverId, setPreviewDriverId] = useState<number | null>(null);
  const [toast, setToast] = useState<ActionToastData | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const mutationVersion = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchLogistics(previewDriverId ?? undefined)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLastUpdatedAt(new Date());
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [previewDriverId]);

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
      failure_reason: '',
      failure_note: '',
      failed_at: null,
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

  const revertToInDelivery = async (orderIds: number[]) => {
    setToast(null);
    const results = await Promise.allSettled(orderIds.map((id) => updateOrderStatus(id, 'in_delivery')));

    const revertedIds = orderIds.filter((_, i) => results[i].status === 'fulfilled');
    if (revertedIds.length > 0) {
      mutationVersion.current += 1;
      applyOrderStatus(revertedIds, 'in_delivery');
    }

    const failure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failure) {
      console.error('Błąd podczas cofania zmiany statusu:', failure.reason);
      showActionError(failure.reason);
    }
  };

  const withdrawProblem = async (orderIds: number[]) => {
    setToast(null);
    try {
      const result = await withdrawProblemReport(orderIds);
      mutationVersion.current += 1;
      applyOrderStatus(result.reverted_ids, 'in_delivery');
      setToast({ variant: 'success', text: 'Zgłoszenie wycofane. Biuro zostało powiadomione.' });
    } catch (err) {
      console.error('Błąd podczas wycofywania zgłoszenia:', err);
      showActionError(err);
    }
  };

  const handleAdvance = async (orderId: number, nextStatus: LogisticsOrder['status']) => {
    setUpdatingId(orderId);
    try {
      const result = await updateOrderStatus(orderId, nextStatus);
      mutationVersion.current += 1;
      applyOrderStatus([orderId], nextStatus, result.delivered_at);
      if (nextStatus === 'delivered') {
        setToast({
          variant: 'success',
          text: 'Oznaczono jako dostarczone.',
          onUndo: () => revertToInDelivery([orderId]),
        });
      }
    } catch (err) {
      console.error('Błąd podczas aktualizacji statusu zamówienia:', err);
      showActionError(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeliverStop = async (clientId: number) => {
    setDeliveringStopId(clientId);
    try {
      const result = await deliverStop(clientId);
      mutationVersion.current += 1;
      applyOrderStatus(result.delivered_ids, 'delivered', result.delivered_at);
      setToast({
        variant: 'success',
        text: `Przystanek oznaczony jako dostarczony (${result.delivered_ids.length} poz.).`,
        onUndo: () => revertToInDelivery(result.delivered_ids),
      });
    } catch (err) {
      console.error('Błąd podczas dostarczania przystanku:', err);
      showActionError(err);
    } finally {
      setDeliveringStopId(null);
    }
  };

  const handleReportProblem = async (target: ProblemTarget, reason: FailureReason, note: string): Promise<boolean> => {
    try {
      const result =
        target.kind === 'stop'
          ? await reportStopProblem(target.clientId, reason, note)
          : await reportOrderProblem(target.orderId, reason, note);
      mutationVersion.current += 1;
      patchOrders(result.failed_ids, {
        status: 'failed',
        delivered_at: null,
        failure_reason: result.failure_reason,
        failure_note: result.failure_note,
        failed_at: result.failed_at,
      });
      setToast({
        variant: 'success',
        text: `Zgłoszono problem: ${FAILURE_REASON_LABELS[result.failure_reason]}. Biuro zostało powiadomione.`,
        onUndo: () => withdrawProblem(result.failed_ids),
      });
      return true;
    } catch (err) {
      console.error('Błąd podczas zgłaszania problemu:', err);
      showActionError(err);
      return false;
    }
  };

  const refreshData = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      const versionAtStart = mutationVersion.current;
      if (!silent) {
        setToast(null);
        setRefreshing(true);
      }
      try {
        const result = await fetchLogistics(previewDriverId ?? undefined);
        if (mutationVersion.current !== versionAtStart) return;
        setData(result);
        setError(null);
        setLastUpdatedAt(new Date());
      } catch {
        if (!silent) {
          setToast({ text: 'Nie udało się odświeżyć danych. Spróbuj ponownie.', canRefresh: true });
        }
      } finally {
        if (!silent) setRefreshing(false);
      }
    },
    [previewDriverId]
  );

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') refreshData({ silent: true });
    };

    const intervalId = setInterval(refreshIfVisible, AUTO_REFRESH_MS);
    document.addEventListener('visibilitychange', refreshIfVisible);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [refreshData]);

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
        <DriverRouteView
          date={data.date}
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
        />
        <ActionToast toast={toast} onClose={closeToast} onRefresh={() => refreshData()} />
      </div>
    );
  }

  const routes = data.routes;
  const unassigned = data.unassigned;
  const deliveriesToday =
    routes.reduce((sum, r) => sum + r.stops.filter((s) => s.orders.length > 0).length, 0) + unassigned.length;
  const problemStops = [
    ...routes.flatMap((route) => route.stops.map((stop) => ({ stop, routeName: route.route_name }))),
    ...unassigned.map((stop) => ({ stop, routeName: 'Bez trasy' })),
  ].filter(({ stop }) => stop.orders.some((o) => o.status === 'failed'));

  return (
    <div className="w-full max-w-7xl mx-auto px-8 py-6 flex flex-col gap-5 text-bakery-dark">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="m-0 mb-1 text-2xl font-bold tracking-tight text-bakery-dark">Logistyka i Trasy</h1>
          <p className="text-xs text-gray-500 font-medium">
            Plan dostaw na dziś ({data.date}) — {deliveriesToday} {deliveriesToday === 1 ? 'dostawa' : 'dostaw(y)'} w{' '}
            {routes.length} {routes.length === 1 ? 'trasie' : 'trasach'}.
          </p>
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
                    <StopCard key={stop.client_id} stop={stop} onAdvance={handleAdvance} updatingId={updatingId} />
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
              <StopCard key={stop.client_id} stop={stop} onAdvance={handleAdvance} updatingId={updatingId} />
            ))}
          </div>
        </div>
      )}
      <ActionToast toast={toast} onClose={closeToast} onRefresh={() => refreshData()} />
    </div>
  );
}
