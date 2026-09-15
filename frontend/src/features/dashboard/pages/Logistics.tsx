import { useEffect, useState } from 'react';
import { Truck, User, AlertTriangle, Eye, Map } from 'lucide-react';
import {
  fetchLogistics,
  fetchRouteDirections,
  updateOrderStatus,
  type LogisticsData,
  type LogisticsOrder,
  type RouteDirections,
} from '../../../services/api';
import { StopCard } from '../components/StopCard';
import { DriverRouteView } from '../components/DriverRouteView';
import { RouteMap } from '../components/RouteMap';
import { RouteSummary } from '../components/RouteSummary';

export default function Logistics() {
  const [data, setData] = useState<LogisticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [previewDriverId, setPreviewDriverId] = useState<number | null>(null);
  const [mapOpenRouteId, setMapOpenRouteId] = useState<number | null>(null);
  const [directionsByRoute, setDirectionsByRoute] = useState<Record<number, RouteDirections>>({});
  const [loadingDirectionsFor, setLoadingDirectionsFor] = useState<number | null>(null);
  const [directionsErrorByRoute, setDirectionsErrorByRoute] = useState<Record<number, string>>({});

  const handleToggleMap = async (routeId: number, date: string) => {
    const opening = mapOpenRouteId !== routeId;
    setMapOpenRouteId(opening ? routeId : null);
    if (opening && !directionsByRoute[routeId] && loadingDirectionsFor !== routeId) {
      setLoadingDirectionsFor(routeId);
      setDirectionsErrorByRoute((prev) => {
        const next = { ...prev };
        delete next[routeId];
        return next;
      });
      try {
        const result = await fetchRouteDirections(routeId, date);
        setDirectionsByRoute((prev) => ({ ...prev, [routeId]: result }));
      } catch (err) {
        setDirectionsErrorByRoute((prev) => ({
          ...prev,
          [routeId]: err instanceof Error ? err.message : 'Nieznany błąd',
        }));
      } finally {
        setLoadingDirectionsFor(null);
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchLogistics(previewDriverId ?? undefined)
      .then((result) => {
        if (!cancelled) {
          setData(result);
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

  const handleAdvance = async (orderId: number, nextStatus: LogisticsOrder['status']) => {
    setUpdatingId(orderId);
    try {
      await updateOrderStatus(orderId, nextStatus);
      setData((prev) => {
        if (!prev) return prev;
        const patchStop = (stop: (typeof prev.unassigned)[number]) => ({
          ...stop,
          orders: stop.orders.map((o) => (o.do_id === orderId ? { ...o, status: nextStatus } : o)),
        });
        return {
          ...prev,
          routes: prev.routes.map((route) => ({ ...route, stops: route.stops.map(patchStop) })),
          unassigned: prev.unassigned.map(patchStop),
        };
      });
    } catch (err) {
      console.error('Błąd podczas aktualizacji statusu zamówienia:', err);
      alert('Nie udało się zaktualizować statusu zamówienia.');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-8 py-6 text-bakery-dark">
        <h1 className="text-2xl font-bold mb-2">Logistyka i Trasy</h1>
        <p>Ładowanie danych...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-7xl mx-auto px-8 py-6 text-bakery-dark">
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
      <div className="w-full max-w-7xl mx-auto px-8 py-6">
        <DriverRouteView
          date={data.date}
          route={data.routes[0] ?? null}
          onAdvance={handleAdvance}
          updatingId={updatingId}
          previewDriverName={previewDriverName}
          onExitPreview={() => setPreviewDriverId(null)}
        />
      </div>
    );
  }

  const routes = data.routes;
  const unassigned = data.unassigned;
  const deliveriesToday =
    routes.reduce((sum, r) => sum + r.stops.filter((s) => s.orders.length > 0).length, 0) + unassigned.length;

  return (
    <div className="w-full max-w-7xl mx-auto px-8 py-6 flex flex-col gap-5 text-bakery-dark">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="m-0 mb-1 text-2xl font-bold tracking-tight text-bakery-dark">Logistyka i Trasy</h1>
          <p className="text-xs text-gray-500 font-medium">
            Plan dostaw na dziś ({data.date}) — {deliveriesToday}{' '}
            {deliveriesToday === 1 ? 'dostawa' : 'dostaw(y)'} w {routes.length}{' '}
            {routes.length === 1 ? 'trasie' : 'trasach'}.
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

      {routes.length === 0 && unassigned.length === 0 ? (
        <div className="bg-bakery-inactive rounded border border-bakery-btnBorder shadow-sm p-8 text-center text-gray-500 text-sm font-semibold italic">
          Brak skonfigurowanych aktywnych tras.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {routes.map((route) => {
            const hasDeliveriesToday = route.stops.some((s) => s.orders.length > 0);
            const mapOpen = mapOpenRouteId === route.route_id;
            return (
            <div
              key={route.route_id}
              className={`bg-bakery-inactive rounded border border-bakery-btnBorder shadow-sm flex flex-col overflow-hidden ${mapOpen ? 'md:col-span-2' : ''}`}
            >
              <div className="bg-bakery-dark text-white p-3 flex items-center justify-between gap-2 shrink-0">
                <span className="text-sm font-bold flex items-center gap-2">
                  <Truck className="w-4 h-4 text-bakery-accent" /> {route.route_name}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold flex items-center gap-1.5 text-gray-300">
                    <User className="w-3.5 h-3.5" />
                    {route.driver ? route.driver.full_name : 'Brak kierowcy'}
                  </span>
                  {hasDeliveriesToday && (
                    <button
                      onClick={() => handleToggleMap(route.route_id, data.date)}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold bg-bakery-accent text-black rounded shadow-xs transition active:scale-[0.98]"
                    >
                      <Map className="w-3 h-3" /> {mapOpen ? 'Ukryj mapę' : 'Mapa'}
                    </button>
                  )}
                  {route.driver && (
                    <button
                      onClick={() => setPreviewDriverId(route.driver!.user_id)}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold bg-bakery-accent text-black rounded shadow-xs transition active:scale-[0.98]"
                    >
                      <Eye className="w-3 h-3" /> Podgląd
                    </button>
                  )}
                </div>
              </div>

              {mapOpen && (
                <>
                  <div className="p-3 pb-0">
                    <RouteMap stops={route.stops} directions={directionsByRoute[route.route_id] ?? null} />
                  </div>
                  <RouteSummary
                    directions={directionsByRoute[route.route_id] ?? null}
                    loading={loadingDirectionsFor === route.route_id}
                    error={directionsErrorByRoute[route.route_id] ?? null}
                  />
                </>
              )}

              <div className="p-3 flex flex-col gap-2">
                {route.stops.length === 0 ? (
                  <p className="text-xs text-gray-500 italic font-semibold text-center py-4">
                    Brak dostaw na tej trasie dzisiaj.
                  </p>
                ) : (
                  route.stops.map((stop) => (
                    <StopCard key={stop.client_id} stop={stop} onAdvance={handleAdvance} updatingId={updatingId} />
                  ))
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {unassigned.length > 0 && (
        <div className="bg-bakery-inactive rounded border border-amber-400 shadow-sm overflow-hidden">
          <div className="bg-amber-50 border-b border-amber-300 p-3 flex items-center gap-2">
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
    </div>
  );
}
