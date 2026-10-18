import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const PIN = L.divIcon({
  className: '',
  html: `<svg width="30" height="40" viewBox="0 0 24 32" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4))">
    <path d="M12 31s-10-10.5-10-18a10 10 0 0 1 20 0c0 7.5-10 18-10 18Z" fill="#b91c1c" stroke="white" stroke-width="2"/>
    <circle cx="12" cy="13" r="3.8" fill="white"/>
  </svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
});

export function LocationMap({
  latitude,
  longitude,
  label,
  className = 'h-[160px]',
}: {
  latitude: string;
  longitude: string;
  label: string;
  className?: string;
}) {
  const position: [number, number] = [Number(latitude), Number(longitude)];

  return (
    <div role="img" aria-label={`Mapa: ${label}`} className={`relative z-0 ${className}`}>
      <MapContainer
        key={position.join(',')}
        center={position}
        zoom={15}
        scrollWheelZoom={false}
        attributionControl={false}
        className="w-full h-full"
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={position} icon={PIN} keyboard={false} />
      </MapContainer>
      <span className="absolute bottom-1 right-1.5 z-[1000] px-1 rounded bg-white/80 text-[10px] text-[#3d3937]">
        © OpenStreetMap
      </span>
    </div>
  );
}