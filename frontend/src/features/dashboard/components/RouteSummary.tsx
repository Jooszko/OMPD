import { AlertCircle, Info, Navigation } from 'lucide-react';
import { type RouteDirections } from '../../../services/api';
import { buildGoogleMapsDirectionsUrl } from '../lib/navigationLinks';

function formatDuration(durationS: number): string {
  const totalMinutes = Math.round(durationS / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} godz ${minutes} min` : `${hours} godz`;
}

export function RouteSummary({
  directions,
  loading,
  error,
}: {
  directions: RouteDirections | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="px-3 pt-3 pb-3 flex items-center gap-2">
        <div className="h-8 w-36 rounded-lg bg-bakery-rowBg border border-bakery-btnBorder animate-pulse" />
        <div className="h-8 w-28 rounded-lg bg-bakery-rowBg border border-bakery-btnBorder animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-xs text-red-600 font-semibold px-3 pt-2 pb-3 m-0 flex items-center gap-1.5">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Błąd routingu: {error}
      </p>
    );
  }

  if (!directions) return null;

  if (!directions.geometry || directions.distance_m == null || directions.duration_s == null) {
    return (
      <p className="text-xs text-gray-500 font-semibold px-3 pt-2 pb-3 m-0 flex items-center gap-1.5">
        <Info className="w-3.5 h-3.5 shrink-0" /> {directions.note ?? 'Brak danych o trasie.'}
      </p>
    );
  }

  const km = (directions.distance_m / 1000).toFixed(1);
  const googleMaps = buildGoogleMapsDirectionsUrl(directions.ordered_stops);

  return (
    <div className="px-3 pt-3 pb-3 flex flex-col gap-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-baseline gap-1.5 bg-bakery-rowBg border border-bakery-btnBorder rounded-lg px-3 py-1.5">
          <span className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">Długość trasy</span>
          <span className="text-sm font-extrabold text-bakery-dark">{km} km</span>
        </div>
        <div className="flex items-baseline gap-1.5 bg-bakery-rowBg border border-bakery-btnBorder rounded-lg px-3 py-1.5">
          <span className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">Czas</span>
          <span className="text-sm font-extrabold text-bakery-dark">{formatDuration(directions.duration_s)}</span>
        </div>
        {directions.skipped_stops.length > 0 && (
          <div className="flex items-baseline gap-1.5 bg-amber-50 border border-amber-300 rounded-lg px-3 py-1.5">
            <span className="text-xs font-bold text-amber-700">
              {directions.skipped_stops.length} bez współrzędnych
            </span>
          </div>
        )}
      </div>

      {googleMaps && (
        <div className="flex items-center gap-2">
          <a
            href={googleMaps.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 w-fit px-2.5 py-1 text-[11px] font-bold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded-lg shadow-xs transition active:scale-[0.98]"
          >
            <Navigation className="w-3.5 h-3.5 text-bakery-accent" /> Nawiguj (Google Maps)
          </a>
          {googleMaps.truncated && (
            <span className="text-[10px] text-amber-700 font-semibold italic">
              Google Maps obsługuje max. 9 przystanków pośrednich — część pominięta w linku.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
