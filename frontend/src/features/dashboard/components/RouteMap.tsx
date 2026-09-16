import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { type LogisticsStop, type RouteDirections } from '../../../services/api';

const DELIVERY_COLOR = '#f49f1c';
const NO_DELIVERY_COLOR = '#9ca3af';

function statusIcon(hasDeliveryToday: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${hasDeliveryToday ? DELIVERY_COLOR : NO_DELIVERY_COLOR};
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

function MapLegend() {
  return (
    <div className="absolute bottom-2 left-2 z-[1000] bg-white/90 backdrop-blur-xs rounded-lg px-2 py-1.5 text-[10px] font-semibold text-bakery-dark shadow-sm border border-bakery-btnBorder flex flex-col gap-1">
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full inline-block border border-white shadow-xs" style={{ background: DELIVERY_COLOR }} />
        Dostawa dzisiaj
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full inline-block border border-white shadow-xs" style={{ background: NO_DELIVERY_COLOR }} />
        Brak dostawy dzisiaj
      </span>
    </div>
  );
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function clusterIcon(cluster: L.MarkerCluster) {
  const hasDelivery = cluster
    .getAllChildMarkers()
    .some((m) => (m as L.Marker & { __hasDelivery?: boolean }).__hasDelivery);
  const count = cluster.getChildCount();

  return L.divIcon({
    className: '',
    html: `<div style="
      background:${hasDelivery ? DELIVERY_COLOR : NO_DELIVERY_COLOR};
      color:#1f1f1f;
      width:30px;height:30px;
      border-radius:50%;
      border:2px solid white;
      box-shadow:0 1px 3px rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:800;font-family:sans-serif;
    ">${count}</div>`,
    iconSize: [30, 30],
  });
}

function ClusteredMarkers({ stops }: { stops: (LogisticsStop & { latitude: string; longitude: string })[] }) {
  const map = useMap();

  useEffect(() => {
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 45,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: clusterIcon,
    });

    stops.forEach((stop) => {
      const hasDelivery = stop.orders.length > 0;
      const marker = L.marker([Number(stop.latitude), Number(stop.longitude)], {
        icon: statusIcon(hasDelivery),
      }) as L.Marker & { __hasDelivery?: boolean };
      marker.__hasDelivery = hasDelivery;

      marker.bindTooltip(escapeHtml(stop.name), {
        direction: 'top',
        offset: [0, -6],
        opacity: 0.95,
        className: 'text-[10px] font-bold',
      });
      marker.bindPopup(
        `<strong>${escapeHtml(stop.name)}</strong><br/>${escapeHtml(stop.address)}` +
          (hasDelivery ? '' : '<br/><em>Brak dostawy dzisiaj</em>')
      );

      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);

    return () => {
      map.removeLayer(clusterGroup);
    };
  }, [map, stops]);

  return null;
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
        className={`flex items-center justify-center bg-bakery-inactive border border-dashed border-bakery-btnBorder rounded-lg text-xs text-gray-500 font-semibold italic ${className ?? 'h-72'}`}
      >
        Brak zgeokodowanych przystanków na tej trasie.
      </div>
    );
  }

  const points: [number, number][] = geocodedStops.map((s) => [Number(s.latitude), Number(s.longitude)]);
  const linePoints: [number, number][] = directions?.geometry?.coordinates ?? [];
  const fitPoints = linePoints.length > 0 ? linePoints : points;

  return (
    <div className={`relative rounded-lg overflow-hidden border border-bakery-btnBorder shadow-sm ${className ?? 'h-72'}`}>
      <MapContainer center={points[0]} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <FitBounds points={fitPoints} />
        {linePoints.length > 0 && (
          <Polyline positions={linePoints} pathOptions={{ color: DELIVERY_COLOR, weight: 4, opacity: 0.85 }} />
        )}
        <ClusteredMarkers stops={geocodedStops} />
      </MapContainer>
      <MapLegend />
    </div>
  );
}
