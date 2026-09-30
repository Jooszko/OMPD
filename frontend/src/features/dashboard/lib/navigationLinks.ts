import { type LogisticsStop, type OrderedStop } from '../../../services/api';

const MAX_WAYPOINTS = 9;

export function buildGoogleMapsDirectionsUrl(stops: OrderedStop[]): { url: string; truncated: boolean } | null {
  if (stops.length < 2) return null;

  const origin = stops[0];
  const destination = stops[stops.length - 1];
  const middle = stops.slice(1, -1);
  const truncated = middle.length > MAX_WAYPOINTS;
  const waypoints = truncated ? middle.slice(0, MAX_WAYPOINTS) : middle;

  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    travelmode: 'driving',
  });
  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.map((s) => `${s.latitude},${s.longitude}`).join('|'));
  }

  return { url: `https://www.google.com/maps/dir/?${params.toString()}`, truncated };
}

export function buildGoogleMapsStopUrl(stop: LogisticsStop): string {
  const destination = stop.latitude && stop.longitude ? `${stop.latitude},${stop.longitude}` : stop.address;

  const params = new URLSearchParams({
    api: '1',
    destination,
    travelmode: 'driving',
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
