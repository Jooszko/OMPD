import { useEffect, useState } from 'react';
import { ArrowLeft, Inbox, RefreshCw, Truck } from 'lucide-react';
import {
  fetchRouteDirections,
  type LogisticsOrder,
  type LogisticsRoute,
  type RouteDirections,
  type FailureReason,
  type DeliveryProof,
} from '../../../services/api';
import { DriverStopCard } from './DriverStopCard';
import { RouteMap } from './RouteMap';
import { RouteSummary } from './RouteSummary';
import { orderStopsByRoute } from '../lib/stopOrder';
import { getRouteProgress } from '../lib/routeProgress';
import { type ProblemTarget } from './ReportProblemDialog';
import { formatDayLabel } from '../lib/dateFormat';
import { DayNavigator, HistoryNotice } from './DayNavigator';

interface DirectionsState {
  routeKey: string;
  requestKey: string;
  data: RouteDirections | null;
  error: string | null;
}

export function DriverRouteView({
  date,
  today,
  onChangeDate,
  routes,
  onAdvance,
  updatingId,
  onDeliverStop,
  deliveringStopId,
  onReportProblem,
  onSaveDeliveryNote,
  onRefresh,
  refreshing,
  lastUpdatedAt,
  previewDriverName,
  onExitPreview,
  onUploadProof,
  onDeleteProof,
}: {
  date: string;
  today: string;
  onChangeDate: (date: string | null) => void;
  routes: LogisticsRoute[];
  onAdvance: (orderId: number, nextStatus: LogisticsOrder['status']) => void;
  updatingId: number | null;
  onDeliverStop: (clientId: number) => void;
  deliveringStopId: number | null;
  onReportProblem: (target: ProblemTarget, reason: FailureReason, note: string) => Promise<boolean>;
  onSaveDeliveryNote: (clientId: number, note: string) => Promise<boolean>;
  onRefresh: () => void;
  refreshing: boolean;
  lastUpdatedAt: Date | null;
  previewDriverName?: string;
  onExitPreview?: () => void;
  onUploadProof: (clientId: number, kind: DeliveryProof['kind'], image: Blob, signerName?: string) => Promise<boolean>;
  onDeleteProof: (clientId: number, proofId: number) => Promise<boolean>;
}) {
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const route = routes.find((r) => r.route_id === selectedRouteId) ?? routes[0] ?? null;
  const isHistory = date !== today;
  const [directionsState, setDirectionsState] = useState<DirectionsState | null>(null);
  const deliveryStopIds = route?.stops.filter((s) => s.orders.length > 0).map((s) => s.client_id) ?? [];
  const deliveriesToday = deliveryStopIds.length;
  const routeId = route?.route_id ?? null;
  const routeKey = routeId !== null ? `${routeId}|${date}` : null;
  const requestKey =
    routeKey !== null && deliveriesToday > 0
      ? `${routeKey}|${[...deliveryStopIds].sort((a, b) => a - b).join(',')}`
      : null;
  const directionsForRoute = directionsState?.routeKey === routeKey ? directionsState : null;
  const directions = directionsForRoute?.data ?? null;
  const directionsError = directionsForRoute?.error ?? null;
  const loadingDirections = requestKey !== null && directionsState?.requestKey !== requestKey;
  const sequencedStops = route ? orderStopsByRoute(route.stops, directions) : [];
  const progress = route ? getRouteProgress(route.stops) : { done: 0, failed: 0, total: 0 };
  const allDone = progress.total > 0 && progress.done === progress.total;
  const allDelivered = allDone && progress.failed === 0;
  const dateLabel = formatDayLabel(date);
  const nextStopId = isHistory
    ? null
    : (sequencedStops.find(({ stop }) => stop.orders.some((o) => o.status === 'in_delivery'))?.stop.client_id ?? null);

  useEffect(() => {
    if (routeId === null || routeKey === null || requestKey === null) return;

    let cancelled = false;
    fetchRouteDirections(routeId, date)
      .then((data) => {
        if (!cancelled) setDirectionsState({ routeKey, requestKey, data, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setDirectionsState({ routeKey, requestKey, data: null, error: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, [routeId, date, routeKey, requestKey]);

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-4 sm:gap-5 text-bakery-dark">
      {previewDriverName && onExitPreview && (
        <div className="bg-amber-50 border border-amber-300 rounded p-2.5 flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-amber-800">Podgląd widoku kierowcy: {previewDriverName}</span>
          <button
            onClick={onExitPreview}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded shadow-xs transition active:scale-[0.98]"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Powrót
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="m-0 text-xl sm:text-2xl font-bold tracking-tight text-bakery-dark">
              {isHistory ? 'Historia trasy' : 'Moja trasa'}
            </h1>
            <p className="mt-0.5 text-xs text-gray-500 font-medium first-letter:uppercase">
              {route ? dateLabel : 'Brak przypisanej trasy.'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {lastUpdatedAt && (
              <span className="text-[11px] text-gray-500 font-medium whitespace-nowrap">
                <span className="hidden sm:inline">Aktualizacja: </span>
                {lastUpdatedAt.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Odśwież dane"
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 px-2.5 sm:py-1 text-[11px] font-bold bg-white border border-bakery-btnBorder text-bakery-dark rounded-lg shadow-xs transition hover:bg-bakery-inactive active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Odśwież</span>
            </button>
          </div>
        </div>

        {routes.length > 1 && (
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Twoje trasy">
            {routes.map((r) => {
              const isActive = r.route_id === route?.route_id;
              const count = r.stops.filter((s) => s.orders.length > 0).length;
              return (
                <button
                  key={r.route_id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setSelectedRouteId(r.route_id)}
                  className={`min-h-[44px] sm:min-h-0 px-3.5 py-1.5 text-xs font-bold rounded-lg border transition active:scale-[0.98] ${
                    isActive
                      ? 'bg-bakery-dark text-white border-bakery-dark'
                      : 'bg-bakery-rowBg text-bakery-dark border-bakery-btnBorder hover:bg-bakery-inactive'
                  }`}
                >
                  {r.route_name} <span className={isActive ? 'text-bakery-accent' : 'text-gray-500'}>({count})</span>
                </button>
              );
            })}
          </div>
        )}
        <DayNavigator date={date} today={today} onChangeDate={onChangeDate} />
        {isHistory && <HistoryNotice />}

        {isHistory && (
          <p className="m-0 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2 text-xs font-semibold text-sky-800">
            Podgląd historii, tylko do odczytu. Statusów z innych dni nie można zmieniać.
          </p>
        )}
      </div>

      <hr className="hidden sm:block border-0 border-t border-bakery-border my-1" />

      {!route ? (
        <div className="bg-bakery-inactive rounded-xl border border-bakery-btnBorder shadow-sm p-8 flex flex-col items-center gap-2 text-center text-gray-500 text-sm font-semibold italic">
          <Truck className="w-6 h-6 text-gray-400" />
          Nie masz przypisanej aktywnej trasy.
        </div>
      ) : (
        <div className="bg-bakery-inactive rounded-xl border border-bakery-btnBorder shadow-md flex flex-col overflow-hidden">
          <div className="bg-bakery-dark text-white p-3.5 flex flex-col gap-2.5 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-bold">
                <Truck className="w-4 h-4 text-bakery-accent" /> {route.route_name}
              </span>
              {progress.total > 0 && (
                <span className="text-xs font-bold text-gray-300 whitespace-nowrap">
                  {allDelivered
                    ? 'Wszystko dostarczone'
                    : allDone
                      ? 'Trasa zakończona'
                      : `Obsłużono ${progress.done} / ${progress.total}`}
                  {progress.failed > 0 && <span className="text-rose-300"> · problemy: {progress.failed}</span>}
                </span>
              )}
            </div>
            {progress.total > 0 && (
              <div
                role="progressbar"
                aria-label="Postęp dostaw na trasie"
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-valuenow={progress.done}
                className="h-1.5 w-full rounded-full bg-white/15 overflow-hidden"
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${
                    allDelivered ? 'bg-emerald-600' : 'bg-bakery-accent'
                  }`}
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
            )}
          </div>

          <div className="p-3 flex flex-col gap-2">
            {route.stops.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 text-gray-500 text-xs font-semibold italic text-center py-6">
                <Inbox className="w-5 h-5 text-gray-400" />
                Brak dostaw na tej trasie dzisiaj.
              </div>
            ) : (
              sequencedStops.map(({ stop, sequence }) => (
                <DriverStopCard
                  key={stop.client_id}
                  stop={stop}
                  sequence={sequence}
                  isNext={stop.client_id === nextStopId}
                  onAdvance={onAdvance}
                  updatingId={updatingId}
                  onDeliverStop={onDeliverStop}
                  deliveringStopId={deliveringStopId}
                  onReportProblem={onReportProblem}
                  onSaveDeliveryNote={onSaveDeliveryNote}
                  readOnly={isHistory}
                  onUploadProof={onUploadProof}
                  onDeleteProof={onDeleteProof}
                />
              ))
            )}
          </div>

          {deliveriesToday > 0 && (
            <>
              <div className="p-3 pt-0">
                <RouteMap stops={route.stops} directions={directions} />
              </div>
              <RouteSummary directions={directions} loading={loadingDirections} error={directionsError} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
