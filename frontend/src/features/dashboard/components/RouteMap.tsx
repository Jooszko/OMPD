import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { type LogisticsStop, type RouteDirections } from '../../../services/api';
import { getStopSequences } from '../lib/stopOrder';
import { isStopDelivered } from '../lib/routeProgress';

const DELIVERY_COLOR = '#f49f1c';
const NO_DELIVERY_COLOR = '#9ca3af';
const CLUSTER_COLOR = '#1f1f1f';
const DELIVERED_COLOR = '#059669';

type StopMarker = L.Marker & { __hasDelivery?: boolean; __sequence?: number | null; __delivered?: boolean };

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

function sequenceIcon(sequence: number, delivered: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${delivered ? DELIVERED_COLOR : DELIVERY_COLOR};
      color:${delivered ? 'white' : '#1f1f1f'};
      width:24px;height:24px;
      border-radius:50%;
      border:2px solid white;
      box-shadow:0 1px 3px rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:800;font-family:sans-serif;
    ">${sequence}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

function MapLegend() {
  return (
    <div className="absolute bottom-2 left-2 z-[1000] bg-white/90 backdrop-blur-xs rounded-lg px-2 py-1.5 text-[10px] font-semibold text-bakery-dark shadow-sm border border-bakery-btnBorder flex flex-col gap-1">
      <span className="flex items-center gap-1.5">
        <span
          className="w-3.5 h-3.5 rounded-full inline-flex items-center justify-center text-[8px] font-extrabold text-[#1f1f1f] border border-white shadow-xs"
          style={{ background: DELIVERY_COLOR }}
        >
          1
        </span>
        Kolejność na trasie
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="w-3.5 h-3.5 rounded-full inline-flex items-center justify-center text-[8px] font-extrabold text-white border border-white shadow-xs"
          style={{ background: DELIVERED_COLOR }}
        >
          1
        </span>
        Dostarczone
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="w-3.5 h-3.5 rounded-[3px] inline-flex items-center justify-center text-[8px] font-extrabold text-white shadow-xs"
          style={{ background: CLUSTER_COLOR, border: `1px solid ${DELIVERY_COLOR}` }}
        >
          2
        </span>
        Kilka przystanków (kliknij)
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="w-2.5 h-2.5 rounded-full inline-block border border-white shadow-xs"
          style={{ background: DELIVERY_COLOR }}
        />
        Dostawa dzisiaj
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="w-2.5 h-2.5 rounded-full inline-block border border-white shadow-xs"
          style={{ background: NO_DELIVERY_COLOR }}
        />
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
  const markers = cluster.getAllChildMarkers() as StopMarker[];
  const hasDelivery = markers.some((m) => m.__hasDelivery);
  const sequences = markers
    .map((m) => m.__sequence)
    .filter((s): s is number => s != null)
    .sort((a, b) => a - b);
  const count = cluster.getChildCount();
  const hasPendingSequence = markers.some((m) => m.__sequence != null && !m.__delivered);

  const badge =
    sequences.length > 0
      ? `<div style="
          position:absolute;top:-9px;right:-11px;
          background:${hasPendingSequence ? DELIVERY_COLOR : DELIVERED_COLOR};
          color:${hasPendingSequence ? '#1f1f1f' : 'white'};
          min-width:18px;height:18px;padding:0 4px;
          border-radius:9px;border:2px solid white;
          box-shadow:0 1px 2px rgba(0,0,0,0.4);
          display:flex;align-items:center;justify-content:center;
          font-size:10px;font-weight:800;font-family:sans-serif;white-space:nowrap;
        ">${sequences.join(', ')}</div>`
      : '';

  return L.divIcon({
    className: '',
    html: `<div style="
      position:relative;
      background:${CLUSTER_COLOR};
      color:white;
      width:30px;height:30px;
      border-radius:8px;
      border:2px solid ${hasDelivery ? DELIVERY_COLOR : NO_DELIVERY_COLOR};
      box-shadow:0 1px 3px rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:800;font-family:sans-serif;
    ">${count}${badge}</div>`,
    iconSize: [30, 30],
  });
}

function ClusteredMarkers({
  stops,
  sequenceById,
}: {
  stops: (LogisticsStop & { latitude: string; longitude: string })[];
  sequenceById: Map<number, number>;
}) {
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
      const sequence = sequenceById.get(stop.client_id) ?? null;
      const delivered = isStopDelivered(stop);
      const marker = L.marker([Number(stop.latitude), Number(stop.longitude)], {
        icon: sequence != null ? sequenceIcon(sequence, delivered) : statusIcon(hasDelivery),
        zIndexOffset: sequence != null ? 1000 : 0,
      }) as StopMarker;
      marker.__hasDelivery = hasDelivery;
      marker.__sequence = sequence;
      marker.__delivered = delivered;

      const label = sequence != null ? `${sequence}. ${stop.name}` : stop.name;
      marker.bindTooltip(escapeHtml(label), {
        direction: 'top',
        offset: [0, -6],
        opacity: 0.95,
        className: 'text-[10px] font-bold',
      });
      marker.bindPopup(
        `<strong>${escapeHtml(label)}</strong><br/>${escapeHtml(stop.address)}` +
          (hasDelivery ? '' : '<br/><em>Brak dostawy dzisiaj</em>')
      );

      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);

    return () => {
      map.removeLayer(clusterGroup);
    };
  }, [map, stops, sequenceById]);

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
  const geocodedStops = useMemo(
    () =>
      stops.filter(
        (s): s is LogisticsStop & { latitude: string; longitude: string } => !!s.latitude && !!s.longitude
      ),
    [stops]
  );
  const sequenceById = useMemo(() => getStopSequences(directions), [directions]);
  const fitPoints = useMemo<[number, number][]>(() => {
    const line = directions?.geometry?.coordinates ?? [];
    if (line.length > 0) return line;
    return geocodedStops.map((s) => [Number(s.latitude), Number(s.longitude)]);
  }, [directions, geocodedStops]);

  if (geocodedStops.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-bakery-inactive border border-dashed border-bakery-btnBorder rounded-lg text-xs text-gray-500 font-semibold italic ${className ?? 'h-72'}`}
      >
        Brak zgeokodowanych przystanków na tej trasie.
      </div>
    );
  }

  const linePoints: [number, number][] = directions?.geometry?.coordinates ?? [];

  return (
    <div
      className={`relative isolate rounded-lg overflow-hidden border border-bakery-btnBorder shadow-sm ${className ?? 'h-72'}`}
    >
      <MapContainer center={fitPoints[0]} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <FitBounds points={fitPoints} />
        {linePoints.length > 0 && (
          <Polyline positions={linePoints} pathOptions={{ color: DELIVERY_COLOR, weight: 4, opacity: 0.85 }} />
        )}
        <ClusteredMarkers stops={geocodedStops} sequenceById={sequenceById} />
      </MapContainer>
      <MapLegend />
    </div>
  );
}
