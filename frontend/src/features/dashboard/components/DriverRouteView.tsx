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

export function DriverRouteView({
  date,
  route,
  onAdvance,
  updatingId,
  previewDriverName,
  onExitPreview,
}: {
  date?: string;
  route: LogisticsRoute | null;
  onAdvance: (orderId: number, nextStatus: LogisticsOrder['status']) => void;
  updatingId: number | null;
  previewDriverName?: string;
  onExitPreview?: () => void;
}) {
  const [directions, setDirections] = useState<RouteDirections | null>(null);
  const [loadingDirections, setLoadingDirections] = useState(false);
  const [directionsError, setDirectionsError] = useState<string | null>(null);
  const deliveriesToday = route?.stops.filter((s) => s.orders.length > 0).length ?? 0;

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
          <span className="text-xs font-bold text-amber-800">
            Podgląd widoku kierowcy: {previewDriverName}
          </span>
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
          <div className="bg-bakery-dark text-white p-3.5 flex items-center gap-2 shrink-0">
            <Truck className="w-4 h-4 text-bakery-accent" />
            <span className="text-sm font-bold">{route.route_name}</span>
          </div>

          <div className="p-3 flex flex-col gap-2">
            {route.stops.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 text-gray-500 text-xs font-semibold italic text-center py-6">
                <Inbox className="w-5 h-5 text-gray-400" />
                Brak dostaw na tej trasie dzisiaj.
              </div>
            ) : (
              route.stops.map((stop) => (
                <DriverStopCard key={stop.client_id} stop={stop} onAdvance={onAdvance} updatingId={updatingId} />
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
