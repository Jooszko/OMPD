import { describe, expect, it } from 'vitest';
import { makeOrderedStop, makeStop } from '../../../test/factories';
import { buildGoogleMapsDirectionsUrl, buildGoogleMapsStopUrl } from './navigationLinks';

describe('buildGoogleMapsStopUrl', () => {
  it('navigates to coordinates from the current location', () => {
    const url = new URL(buildGoogleMapsStopUrl(makeStop({ latitude: '49.799000', longitude: '18.786000' })));

    expect(url.searchParams.get('destination')).toBe('49.799000,18.786000');
    expect(url.searchParams.get('travelmode')).toBe('driving');
    expect(url.searchParams.has('origin')).toBe(false);
  });

  it('falls back to the address when coordinates are missing', () => {
    const stop = makeStop({ latitude: null, longitude: null, address: 'Leśna 22, Brenna' });
    const url = new URL(buildGoogleMapsStopUrl(stop));

    expect(url.searchParams.get('destination')).toBe('Leśna 22, Brenna');
  });
});

describe('buildGoogleMapsDirectionsUrl', () => {
  it('returns null for fewer than two stops', () => {
    expect(buildGoogleMapsDirectionsUrl([makeOrderedStop(1)])).toBeNull();
  });

  it('builds a route without waypoints for two stops', () => {
    const result = buildGoogleMapsDirectionsUrl([makeOrderedStop(1), makeOrderedStop(2)]);
    const url = new URL(result!.url);

    expect(result!.truncated).toBe(false);
    expect(url.searchParams.has('waypoints')).toBe(false);
  });

  it('limits waypoints to nine and reports truncation', () => {
    const stops = Array.from({ length: 12 }, (_, i) => makeOrderedStop(i + 1));
    const result = buildGoogleMapsDirectionsUrl(stops);
    const url = new URL(result!.url);

    expect(result!.truncated).toBe(true);
    expect(url.searchParams.get('waypoints')!.split('|')).toHaveLength(9);
  });
});