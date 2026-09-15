import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { type LogisticsStop, type RouteDirections } from '../../../services/api';

function statusIcon(hasDeliveryToday: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${hasDeliveryToday ? '#d4a418' : '#9ca3af'};
      width:16px;height:16px;
      border-radius:50%;
      border:2px solid white;
      box-shadow:0 1px 3px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 15 });
    }
  }, [map, points]);

  return null;
}

export function RouteMap({
  stops,
  directions,
  className,
}: {
  stops: LogisticsStop[];
  directions?: RouteDirections | null;
  className?: string;
}) {
  const geocodedStops = stops.filter(
    (s): s is LogisticsStop & { latitude: string; longitude: string } => !!s.latitude && !!s.longitude
  );

  if (geocodedStops.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-bakery-inactive border border-dashed border-bakery-btnBorder rounded text-xs text-gray-500 font-semibold italic ${className ?? 'h-72'}`}
      >
        Brak zgeokodowanych przystanków na tej trasie.
      </div>
    );
  }

  const points: [number, number][] = geocodedStops.map((s) => [Number(s.latitude), Number(s.longitude)]);
  const linePoints: [number, number][] = directions?.geometry?.coordinates ?? [];
  const fitPoints = linePoints.length > 0 ? linePoints : points;

  return (
    <div className={`rounded overflow-hidden border border-bakery-btnBorder ${className ?? 'h-72'}`}>
      <MapContainer center={points[0]} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <FitBounds points={fitPoints} />
        {linePoints.length > 0 && (
          <Polyline positions={linePoints} pathOptions={{ color: '#d4a418', weight: 4, opacity: 0.85 }} />
        )}
        {geocodedStops.map((stop) => (
          <Marker
            key={stop.client_id}
            position={[Number(stop.latitude), Number(stop.longitude)]}
            icon={statusIcon(stop.orders.length > 0)}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={0.95} className="text-[10px] font-bold">
              {stop.name}
            </Tooltip>
            <Popup>
              <strong>{stop.name}</strong>
              <br />
              {stop.address}
              {stop.orders.length === 0 && (
                <>
                  <br />
                  <em>Brak dostawy dzisiaj</em>
                </>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
