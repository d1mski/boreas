import type { ModuleState, ClimateData, AqiSample, EarthquakeEvent, WildfireEvent } from '../types';
import type { NearbyFeature } from '../hooks/useOverpassFeatures';
import type { FloodSample } from '../hooks/useFlood';
import { countExtremeDays } from './climateAggregation';

export type OverviewSeverity = 'ok' | 'watch' | 'alert' | 'unavailable' | 'not-applicable';

export const SEVERITY_TONE = {
  ok: 'good',
  watch: 'warn',
  alert: 'risk',
  'not-applicable': 'muted',
} as const satisfies Record<Exclude<OverviewSeverity, 'unavailable'>, 'good' | 'warn' | 'risk' | 'muted'>;

export interface SeverityResult {
  severity: OverviewSeverity;
  metric: string | null;
  unit?: string;
}

export function deriveClimateSeverity(state: ModuleState<ClimateData>): SeverityResult {
  if (state.status !== 'success' || state.data === null) {
    return { severity: 'unavailable', metric: null };
  }
  const { daily } = state.data;
  const extremes = countExtremeDays(daily);
  const heatDays = extremes.above35;
  const maxTemp = Math.max(...daily.temperatureMax.filter(Number.isFinite));
  const metric = Number.isFinite(maxTemp) ? `${maxTemp.toFixed(0)}` : null;
  if (metric === null) return { severity: 'unavailable', metric: null };
  let severity: OverviewSeverity;
  if (heatDays > 30) severity = 'alert';
  else if (heatDays >= 5) severity = 'watch';
  else severity = 'ok';
  return { severity, metric, unit: '°C' };
}

export function deriveWindSeverity(state: ModuleState<ClimateData>): SeverityResult {
  if (state.status !== 'success' || state.data === null) {
    return { severity: 'unavailable', metric: null };
  }
  const { daily } = state.data;
  const maxGust = Math.max(...daily.windGustsMax.filter(Number.isFinite));
  if (!Number.isFinite(maxGust)) return { severity: 'unavailable', metric: null };
  const metric = `${maxGust.toFixed(0)}`;
  let severity: OverviewSeverity;
  if (maxGust > 90) severity = 'alert';
  else if (maxGust >= 60) severity = 'watch';
  else severity = 'ok';
  return { severity, metric, unit: 'km/h' };
}

export function deriveSunSeverity(state: ModuleState<ClimateData>): SeverityResult {
  if (state.status !== 'success' || state.data === null) {
    return { severity: 'unavailable', metric: null };
  }
  const { daily } = state.data;
  const maxUv = Math.max(...daily.uvIndexMax.filter(Number.isFinite));
  if (!Number.isFinite(maxUv)) return { severity: 'unavailable', metric: null };
  const metric = `UV ${maxUv.toFixed(0)}`;
  let severity: OverviewSeverity;
  if (maxUv >= 8) severity = 'alert';
  else if (maxUv >= 6) severity = 'watch';
  else severity = 'ok';
  return { severity, metric, unit: '' };
}

export function deriveHazardsSeverity(
  earthquakes: ModuleState<EarthquakeEvent[]>,
  wildfires: ModuleState<WildfireEvent[]>,
  flood: ModuleState<FloodSample[]>,
  floodNotApplicable: boolean,
): SeverityResult {
  const eqDegraded = earthquakes.status === 'error';
  // success + non-null error = partial (one wildfire source failed)
  const wfDegraded =
    wildfires.status === 'error' || (wildfires.status === 'success' && wildfires.error !== null);
  const eqPending = earthquakes.status === 'idle' || earthquakes.status === 'loading';
  const wfPending = wildfires.status === 'idle' || wildfires.status === 'loading';
  const anyDegraded = eqDegraded || wfDegraded;
  const anyPending = eqPending || wfPending;

  if (eqDegraded && wfDegraded) return { severity: 'unavailable', metric: null };

  // Assess earthquake severity directly
  const MS_YEAR = 365 * 24 * 3600 * 1000;
  const now = Date.now();
  let hasCriticalEq = false;
  let hasWatchEq = false;

  const eqData = earthquakes.data ?? [];
  const recentEqs = eqData.filter((e) => now - new Date(e.date).getTime() < 3 * MS_YEAR);
  const strongEqs = eqData.filter((e) => e.magnitude >= 5);
  if (recentEqs.length >= 2 || strongEqs.length > 0) hasWatchEq = true;
  if (strongEqs.some((e) => now - new Date(e.date).getTime() < 5 * MS_YEAR && e.magnitude >= 6)) {
    hasCriticalEq = true;
  }

  // Assess wildfire severity directly
  let hasCriticalWf = false;
  let hasWatchWf = false;
  const wfData = wildfires.data ?? [];
  const recentWf = wfData.filter((w) => now - new Date(w.date).getTime() < MS_YEAR);
  if (recentWf.length > 0) {
    const nearest = recentWf.reduce((a, b) => (a.distanceKm < b.distanceKm ? a : b));
    if (nearest.distanceKm < 30) hasCriticalWf = true;
    else hasWatchWf = true;
  }

  // Compute EQ/wildfire base severity rank (ok=0, watch=1, alert=2)
  let baseRank = 0;
  if (hasWatchEq || hasWatchWf) baseRank = 1;
  if (hasCriticalEq || hasCriticalWf) baseRank = 2;

  // Fold flood contribution — not-applicable does NOT change EQ/WF outcome
  // (flood not-applicable = no river, irrelevant to hazards chapter severity)
  let floodRank = -1; // -1 = ignored (not-applicable or unavailable)
  if (!floodNotApplicable) {
    const floodSev = deriveFloodSeverity(flood, floodNotApplicable).severity;
    if (floodSev === 'alert') floodRank = 2;
    else if (floodSev === 'watch') floodRank = 1;
    else if (floodSev === 'ok') floodRank = 0;
    // 'unavailable' stays -1 (no contribution)
  }

  const finalRank = Math.max(baseRank, floodRank);

  // Honesty rule: a missing/failed source can HIDE hazards but not create
  // them. Positive findings from live sources always surface; a clean result
  // is only trustworthy when every source actually reported.
  if (finalRank === 0 && (anyDegraded || anyPending)) {
    return { severity: 'unavailable', metric: null };
  }
  const RANK_TO_SEVERITY: Record<number, [OverviewSeverity, string]> = {
    0: ['ok', 'LOW'],
    1: ['watch', 'MOD'],
    2: ['alert', 'HIGH'],
  };
  const [severity, metric] = RANK_TO_SEVERITY[finalRank] ?? ['ok', 'LOW'];
  return { severity, metric, unit: '' };
}

export function deriveAirSeverity(state: ModuleState<AqiSample[]>): SeverityResult {
  if (state.status !== 'success' || state.data === null || state.data.length === 0) {
    return { severity: 'unavailable', metric: null };
  }
  const mean = state.data.reduce((s, d) => s + d.pm25, 0) / state.data.length;
  const metric = `${mean.toFixed(1)}`;
  let severity: OverviewSeverity;
  if (mean > 15) severity = 'alert';
  else if (mean >= 5) severity = 'watch';
  else severity = 'ok';
  return { severity, metric, unit: 'ug/m3' };
}

export function deriveContextSeverity(state: ModuleState<NearbyFeature[]>): SeverityResult {
  if (state.status !== 'success' || state.data === null) {
    return { severity: 'unavailable', metric: null };
  }
  const hazards = state.data.filter((f) => f.category === 'hazard');
  if (hazards.length === 0) {
    return { severity: 'ok', metric: null };
  }
  const nearest = hazards.reduce((a, b) => (a.distanceKm < b.distanceKm ? a : b));

  // Alert: wastewater within 500m (military is its own category now, not a hazard)
  const hasAlert = hazards.some(
    (f) => f.subtype === 'wastewater' && f.distanceKm <= 0.5,
  );
  // Watch: any hazard within 1km
  const hasWatch = hazards.some((f) => f.distanceKm <= 1.0);

  let severity: OverviewSeverity;
  if (hasAlert) severity = 'alert';
  else if (hasWatch) severity = 'watch';
  else severity = 'ok';

  return { severity, metric: nearest.distanceKm.toFixed(1), unit: 'km' };
}

// Absolute m³/s bands per Phase 7 ROADMAP. p25/p75 are ensemble forecast
// spread (identical to river_discharge on past reanalysis days) — NOT
// historical percentiles, so they are not used for severity.
export function deriveFloodSeverity(
  state: ModuleState<FloodSample[]>,
  notApplicable: boolean,
): SeverityResult {
  if (notApplicable) {
    return { severity: 'not-applicable', metric: 'No major river within 5km' };
  }
  if (state.status !== 'success' || state.data === null || state.data.length === 0) {
    return { severity: 'unavailable', metric: null };
  }
  const discharges = state.data
    .map(s => s.riverDischarge)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  if (discharges.length === 0) {
    return { severity: 'not-applicable', metric: 'No major river within 5km' };
  }
  const maxDischarge = Math.max(...discharges);
  const metric = `${maxDischarge.toFixed(0)}`;
  if (maxDischarge > 2000) return { severity: 'alert', metric, unit: 'm³/s' };
  if (maxDischarge >= 500) return { severity: 'watch', metric, unit: 'm³/s' };
  return { severity: 'ok', metric, unit: 'm³/s' };
}
