import { describe, it, expect } from 'vitest';
import { deriveHazardsSeverity } from './overviewSeverity';
import type { ModuleState, EarthquakeEvent, WildfireEvent } from '../types';
import type { FloodSample } from '../hooks/useFlood';

const ok = <T,>(data: T): ModuleState<T> => ({ status: 'success', data, error: null });
const err = <T,>(): ModuleState<T> => ({ status: 'error', data: null, error: 'HTTP 500' });
const degraded = <T,>(data: T): ModuleState<T> => ({ status: 'success', data, error: 'FIRMS unavailable' });
const NO_FLOOD: ModuleState<FloodSample[]> = ok([]);

function fire(distanceKm: number, daysAgo: number): WildfireEvent {
  return {
    id: `t:${distanceKm}`, source: 'FIRMS', title: null, lat: 0, lon: 0,
    date: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    distanceKm, magnitudeValue: null, magnitudeUnit: null,
    brightness: null, confidence: null, frp: null, polygon: null,
  };
}

describe('deriveHazardsSeverity honesty', () => {
  it('recent nearby fire raises severity (regression: NaN dates were dropped)', () => {
    const r = deriveHazardsSeverity(ok<EarthquakeEvent[]>([]), ok([fire(5, 2)]), NO_FLOOD, true);
    expect(r.severity).toBe('alert');
  });

  it('one errored source + nothing found = unavailable, not LOW', () => {
    const r = deriveHazardsSeverity(err<EarthquakeEvent[]>(), ok<WildfireEvent[]>([]), NO_FLOOD, true);
    expect(r.severity).toBe('unavailable');
  });

  it('one errored source but the OTHER found a hazard = still alerts', () => {
    const r = deriveHazardsSeverity(err<EarthquakeEvent[]>(), ok([fire(5, 2)]), NO_FLOOD, true);
    expect(r.severity).toBe('alert');
  });

  it('degraded wildfire source (partial success) + nothing found = unavailable', () => {
    const r = deriveHazardsSeverity(ok<EarthquakeEvent[]>([]), degraded<WildfireEvent[]>([]), NO_FLOOD, true);
    expect(r.severity).toBe('unavailable');
  });
});
