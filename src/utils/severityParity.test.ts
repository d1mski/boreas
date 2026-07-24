import { describe, it, expect } from 'vitest';
import { deriveHazardsSeverity } from './overviewSeverity';
import { FIRE_ALERT_KM, FIRE_WATCH_KM, PM25_WATCH, PM25_ALERT } from './severityThresholds';
import type { ModuleState, EarthquakeEvent, WildfireEvent } from '../types';
import type { FloodSample } from '../hooks/useFlood';

const ok = <T,>(data: T): ModuleState<T> => ({ status: 'success', data, error: null });
const NO_FLOOD: ModuleState<FloodSample[]> = ok([]);
const fire = (distanceKm: number): WildfireEvent => ({
  id: `t:${distanceKm}`, source: 'FIRMS', title: null, lat: 0, lon: 0,
  date: new Date(Date.now() - 2 * 86_400_000).toISOString(), distanceKm,
  magnitudeValue: null, magnitudeUnit: null, brightness: null, confidence: null, frp: null, polygon: null,
});
const chip = (km: number) =>
  deriveHazardsSeverity(ok<EarthquakeEvent[]>([]), ok([fire(km)]), NO_FLOOD, true).severity;

describe('one set of fire-distance bands', () => {
  it('inside alert band -> alert; between bands -> watch; beyond watch band -> not alert', () => {
    expect(chip(FIRE_ALERT_KM - 1)).toBe('alert');
    expect(chip(FIRE_ALERT_KM + 1)).toBe('watch');
    expect(chip(FIRE_WATCH_KM + 5)).not.toBe('alert');
  });
  it('constants are sane', () => {
    expect(FIRE_ALERT_KM).toBeLessThan(FIRE_WATCH_KM);
    expect(PM25_WATCH).toBeLessThan(PM25_ALERT);
  });
});

describe('flood folded into the fail-closed honesty rule', () => {
  const eqOkEmpty = ok<EarthquakeEvent[]>([]);
  const wfOkEmpty = ok<WildfireEvent[]>([]);
  const floodErr: ModuleState<FloodSample[]> = { status: 'error', data: null, error: 'HTTP 500' };

  it('flood errored where flood IS applicable, nothing else found -> unavailable', () => {
    // clean-empty eq + clean-empty wf, but a live hazard source silently failed
    const r = deriveHazardsSeverity(eqOkEmpty, wfOkEmpty, floodErr, false);
    expect(r.severity).toBe('unavailable');
  });

  it('flood errored where flood is NOT applicable -> ok (not-applicable ≠ degraded)', () => {
    const r = deriveHazardsSeverity(eqOkEmpty, wfOkEmpty, floodErr, true);
    expect(r.severity).toBe('ok');
  });
});
