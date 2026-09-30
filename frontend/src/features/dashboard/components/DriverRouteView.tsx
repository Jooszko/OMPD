import { useEffect, useState } from 'react';
import { ArrowLeft, Inbox, Truck } from 'lucide-react';
import {
  fetchRouteDirections,
  type LogisticsOrder,
  type LogisticsRoute,
  type RouteDirections,
} from '../../../services/api';
import { DriverStopCard } from './DriverStopCard';
import { RouteMap } from './RouteMap';
import { RouteSummary } from './RouteSummary';
import { orderStopsByRoute } from '../lib/stopOrder';
import { getRouteProgress, isStopDelivered } from '../lib/routeProgress';

export function DriverRouteView({
  date,
  routes,
  onAdvance,
  updatingId,
  previewDriverName,
  onExitPreview,
}: {
  date?: string;
  routes: LogisticsRoute[];
  onAdvance: (orderId: number, nextStatus: LogisticsOrder['status']) => void;
  updatingId: number | null;
  previewDriverName?: string;
  onExitPreview?: () => void;
}) {
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const route = routes.find((r) => r.route_id === selectedRouteId) ?? routes[0] ?? null;
  const [directions, setDirections] = useState<RouteDirections | null>(null);
  const [loadingDirections, setLoadingDirections] = useState(false);
  const [directionsError, setDirectionsError] = useState<string | null>(null);
  const deliveriesToday = route?.stops.filter((s) => s.orders.length > 0).length ?? 0;
  const sequencedStops = route ? orderStopsByRoute(route.stops, directions) : [];
  const progress = route ? getRouteProgress(route.stops) : { done: 0, total: 0 };
  const allDone = progress.total > 0 && progress.done === progress.total;
  const nextStopId =
    sequencedStops.find(({ stop }) => stop.orders.some((o) => o.status === 'in_delivery'))?.stop.client_id ?? null;

  useEffect(() => {
    setDirections(null);
    setDirectionsError(null);

    if (!route || deliveriesToday === 0) return;

    let cancelled = false;
    setLoadingDirections(true);
    fetchRouteDirections(route.route_id, date)
      .then((result) => {
        if (!cancelled) setDirections(result);
      })
      .catch((err: Error) => {
        if (!cancelled) setDirectionsError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingDirections(false);
      });

    return () => {
      cancelled = true;
    };
  }, [route?.route_id, date]);

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-5 text-bakery-dark">
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

      <div>
        <h1 className="m-0 mb-1 text-2xl font-bold tracking-tight text-bakery-dark">
          {route ? route.route_name : 'Moja trasa'}
        </h1>
        {routes.length > 1 && (
          <div className="flex flex-wrap gap-2 my-2" role="tablist" aria-label="Twoje trasy">
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
        <p className="text-xs text-gray-500 font-medium">
          {route
            ? `Plan dostaw na dziś (${date}) — ${deliveriesToday} ${deliveriesToday === 1 ? 'dostawa' : 'dostaw(y)'}.`
            : 'Brak przypisanej trasy na dziś.'}
        </p>
      </div>

      <hr className="border-0 border-t border-bakery-border my-1" />

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
                  {allDone ? 'Wszystko dostarczone' : `Dostarczono ${progress.done} / ${progress.total}`}
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
                    allDone ? 'bg-emerald-600' : 'bg-bakery-accent'
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
