import type {
  AqiSample,
  ClimateData,
  Coordinates,
  EarthquakeEvent,
  WikiArticle,
  WildfireEvent,
} from '../types';
import type { NearbyFeature } from '../hooks/useOverpassFeatures';
import { buildWindRose, DIRECTION_LABELS } from './windRoseData';
import { FIRE_ALERT_KM, FIRE_WATCH_KM, PM25_ALERT, PM25_WATCH, HEAT_DAY_C } from './severityThresholds';

export type RiskSeverity = 'info' | 'watch' | 'warn' | 'critical';
export type RiskCategory =
  | 'seismic'
  | 'pollution'
  | 'wildfire'
  | 'noise'
  | 'aqi'
  | 'heat'
  | 'cold'
  | 'flood'
  | 'services'
  | 'coastal';

export interface Risk {
  id: string;
  category: RiskCategory;
  severity: RiskSeverity;
  title: string;
  detail: string;
}

export interface RiskInputs {
  coords: Coordinates | null;
  climate: ClimateData | null;
  features: NearbyFeature[] | null;
  wiki: WikiArticle[] | null;
  earthquakes: EarthquakeEvent[] | null;
  wildfires: WildfireEvent[] | null;
  aqi: AqiSample[] | null;
  elevation: number | null;
}

function bearing(a: Coordinates, b: Coordinates): number {
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function bucketLabel(deg: number): string {
  const idx = Math.round(deg / 22.5) % 16;
  return DIRECTION_LABELS[idx];
}

const MS_DAY = 24 * 3600 * 1000;
const MS_YEAR = 365 * MS_DAY;
const MS_MONTH = 30 * MS_DAY;

function seismicRisk(eqs: EarthquakeEvent[]): Risk[] {
  if (eqs.length === 0) return [];
  const now = Date.now();
  const threeYearsMs = 3 * MS_YEAR;
  const recent = eqs.filter((e) => now - new Date(e.date).getTime() < threeYearsMs);
  const strong = eqs.filter((e) => e.magnitude >= 5);
  const out: Risk[] = [];

  if (recent.length >= 2) {
    const sorted = recent
      .slice()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const spanMs =
      new Date(sorted[sorted.length - 1].date).getTime() -
      new Date(sorted[0].date).getTime();
    const intervalMonths = spanMs / Math.max(sorted.length - 1, 1) / MS_MONTH;
    if (intervalMonths < 24) {
      const minMag = Math.min(...recent.map((e) => e.magnitude));
      out.push({
        id: 'seismic-cadence',
        category: 'seismic',
        severity: intervalMonths < 6 ? 'warn' : 'watch',
        title: 'SEISMIC CADENCE',
        detail: `${recent.length} events (M${minMag.toFixed(1)}+) past 3 yr · avg ${intervalMonths.toFixed(0)} mo interval`,
      });
    }
  }

  if (strong.length > 0) {
    const last = strong.reduce((a, b) =>
      new Date(a.date) > new Date(b.date) ? a : b,
    );
    const ageMs = now - new Date(last.date).getTime();
    const years = ageMs / MS_YEAR;
    out.push({
      id: 'seismic-strong',
      category: 'seismic',
      severity: years < 5 ? 'warn' : 'watch',
      title: 'MODERATE-STRONG SEISMIC',
      detail: `Last M${last.magnitude.toFixed(1)} · ${
        years < 1 ? `${(years * 12).toFixed(0)} mo` : `${years.toFixed(0)} yr`
      } ago · ${last.distanceKm.toFixed(0)} km`,
    });
  }

  return out;
}

function prevailingShare(climate: ClimateData, prevailingIdx: number): number {
  const dirs = climate.hourly.windDirection10m ?? [];
  const speeds = climate.hourly.windSpeed10m ?? [];
  let countInPrevailing = 0;
  let total = 0;
  for (let i = 0; i < dirs.length; i++) {
    const d = dirs[i];
    const s = speeds[i];
    if (!Number.isFinite(d) || !Number.isFinite(s)) continue;
    if (s < 0.5) continue;
    total++;
    const bucket = Math.round(d / 22.5) % 16;
    if (bucket === prevailingIdx) countInPrevailing++;
  }
  return total > 0 ? countInPrevailing / total : 0;
}

function pollutionDriftRisk(
  coords: Coordinates,
  features: NearbyFeature[],
  climate: ClimateData,
): Risk[] {
  const industrial = features.filter((f) => f.category === 'industrial');
  if (industrial.length === 0) return [];

  const rose = buildWindRose(
    climate.hourly.windSpeed10m ?? [],
    climate.hourly.windDirection10m ?? [],
  );
  if (rose.total === 0) return [];

  const prevailingDeg = rose.prevailingDirection * 22.5;
  const share = prevailingShare(climate, rose.prevailingDirection);

  for (const ind of industrial.slice(0, 5)) {
    const brg = bearing(coords, { lat: ind.lat, lon: ind.lon });
    if (angleDiff(brg, prevailingDeg) <= 30) {
      return [
        {
          id: `pollution-${ind.id}`,
          category: 'pollution',
          severity: share > 0.3 ? 'warn' : 'watch',
          title: 'WIND-BORNE POLLUTION',
          detail: `${DIRECTION_LABELS[rose.prevailingDirection]} wind (${(share * 100).toFixed(0)}% of yr) pulls from ${ind.subtype} ${ind.distanceKm.toFixed(1)} km ${bucketLabel(brg)}`,
        },
      ];
    }
  }
  return [];
}

function wildfireRisk(
  coords: Coordinates,
  wildfires: WildfireEvent[],
  climate: ClimateData | null,
): Risk[] {
  if (wildfires.length === 0) return [];
  const now = Date.now();
  const recent = wildfires.filter(
    (w) => now - new Date(w.date).getTime() < MS_YEAR,
  );
  if (recent.length === 0) return [];

  const nearest = recent.reduce((a, b) => (a.distanceKm < b.distanceKm ? a : b));
  const out: Risk[] = [
    {
      id: 'wildfire-recent',
      category: 'wildfire',
      severity:
        nearest.distanceKm < FIRE_ALERT_KM
          ? 'warn'
          : nearest.distanceKm < FIRE_WATCH_KM
            ? 'watch'
            : 'info',
      title: 'WILDFIRE ACTIVITY',
      detail: `${recent.length} events past 12 mo · nearest ${nearest.distanceKm.toFixed(0)} km`,
    },
  ];

  if (climate) {
    const rose = buildWindRose(
      climate.hourly.windSpeed10m ?? [],
      climate.hourly.windDirection10m ?? [],
    );
    if (rose.total > 0) {
      const prevailingDeg = rose.prevailingDirection * 22.5;
      for (const wf of recent.slice(0, 10)) {
        if (wf.distanceKm > 50) continue;
        const brg = bearing(coords, { lat: wf.lat, lon: wf.lon });
        if (angleDiff(brg, prevailingDeg) <= 30) {
          out.push({
            id: 'wildfire-smoke-bearing',
            category: 'wildfire',
            severity: wf.distanceKm < 20 ? 'warn' : 'watch',
            title: 'SMOKE BEARING',
            detail: `Prevailing ${DIRECTION_LABELS[rose.prevailingDirection]} wind aligns with fire ${wf.distanceKm.toFixed(0)} km ${bucketLabel(brg)}`,
          });
          break;
        }
      }
    }
  }
  return out;
}

function airportNoiseRisk(features: NearbyFeature[]): Risk[] {
  const airports = features.filter((f) => f.category === 'airport');
  if (airports.length === 0) return [];
  const nearest = airports.reduce((a, b) =>
    a.distanceKm < b.distanceKm ? a : b,
  );
  if (nearest.distanceKm > 10) return [];
  return [
    {
      id: 'airport-noise',
      category: 'noise',
      severity:
        nearest.distanceKm < 3
          ? 'warn'
          : nearest.distanceKm < 6
            ? 'watch'
            : 'info',
      title: 'AIRPORT NOISE',
      detail: `${nearest.name ?? 'Aerodrome'} ${nearest.distanceKm.toFixed(1)} km · flight-path exposure likely`,
    },
  ];
}

function aqiRisk(aqi: AqiSample[]): Risk[] {
  if (aqi.length === 0) return [];
  const pm25Values = aqi.map((s) => s.pm25).filter((v): v is number => v !== null && Number.isFinite(v));
  if (pm25Values.length === 0) return [];
  const mean = pm25Values.reduce((a, b) => a + b, 0) / pm25Values.length;
  const WHO_ANNUAL = PM25_WATCH;
  const EU_ANNUAL = 25;
  const ratio = mean / WHO_ANNUAL;
  if (ratio <= 1) return [];
  return [
    {
      id: 'aqi-pm25',
      category: 'aqi',
      severity: mean > EU_ANNUAL ? 'critical' : mean > PM25_ALERT ? 'warn' : 'watch',
      title: 'PM2.5 ABOVE WHO GUIDELINE',
      detail: `Mean ${mean.toFixed(1)} µg/m³ · ${ratio.toFixed(1)}× WHO annual limit (${WHO_ANNUAL} µg/m³)`,
    },
  ];
}

function heatRisk(climate: ClimateData): Risk[] {
  const tMax = climate.daily.temperatureMax ?? [];
  if (tMax.length === 0) return [];
  const hotDays = tMax.filter((t) => Number.isFinite(t) && t >= HEAT_DAY_C).length;
  if (hotDays < 5) return [];
  return [
    {
      id: 'heat-days',
      category: 'heat',
      severity: hotDays > 30 ? 'warn' : 'watch',
      title: 'HEAT STRESS',
      detail: `${hotDays} days ≥ 35°C past 12 mo · cooling demand + health risk`,
    },
  ];
}

function floodKeywordRisk(wiki: WikiArticle[]): Risk[] {
  const KEYWORDS = ['flood', 'tsunami', 'landslide'];
  const hits: Record<string, number> = {};
  for (const a of wiki) {
    const text = (a.extract ?? a.title).toLowerCase();
    for (const k of KEYWORDS) {
      if (text.includes(k)) hits[k] = (hits[k] ?? 0) + 1;
    }
  }
  const keys = Object.keys(hits);
  if (keys.length === 0) return [];
  return [
    {
      id: 'flood-historical',
      category: 'flood',
      severity: 'watch',
      title: 'HISTORICAL HAZARD MENTIONS',
      detail: `Wikipedia refs: ${keys.map((k) => `${k}(${hits[k]})`).join(', ')}`,
    },
  ];
}

function coastalRisk(
  elevation: number,
  features: NearbyFeature[],
): Risk[] {
  if (elevation > 10) return [];
  const water = features.filter((f) => f.category === 'water');
  if (water.length === 0) return [];
  const nearest = water.reduce((a, b) =>
    a.distanceKm < b.distanceKm ? a : b,
  );
  if (nearest.distanceKm > 2) return [];
  return [
    {
      id: 'coastal-low',
      category: 'coastal',
      severity: elevation < 3 ? 'warn' : 'watch',
      title: 'STORM SURGE EXPOSURE',
      detail: `Elevation ${elevation.toFixed(1)} m · ${nearest.distanceKm.toFixed(1)} km from water body`,
    },
  ];
}

function servicesGapRisk(features: NearbyFeature[]): Risk[] {
  const hosp = features.find(
    (f) => f.subtype === 'hospital' || f.subtype === 'clinic',
  );
  const pharm = features.find((f) => f.subtype === 'pharmacy');
  const missing: string[] = [];
  if (!hosp) missing.push('hospital');
  if (!pharm) missing.push('pharmacy');
  if (missing.length === 0) return [];
  return [
    {
      id: 'services-gap',
      category: 'services',
      severity: missing.includes('hospital') ? 'warn' : 'watch',
      title: 'MEDICAL SERVICES GAP',
      detail: `No ${missing.join(' or ')} within search radius · emergency response time increased`,
    },
  ];
}

const SEVERITY_ORDER: Record<RiskSeverity, number> = {
  critical: 0,
  warn: 1,
  watch: 2,
  info: 3,
};

export function synthesiseRisks(i: RiskInputs): Risk[] {
  const out: Risk[] = [];
  if (!i.coords) return out;

  if (i.earthquakes) out.push(...seismicRisk(i.earthquakes));
  if (i.features && i.climate) out.push(...pollutionDriftRisk(i.coords, i.features, i.climate));
  if (i.wildfires) out.push(...wildfireRisk(i.coords, i.wildfires, i.climate));
  if (i.features) out.push(...airportNoiseRisk(i.features));
  if (i.aqi) out.push(...aqiRisk(i.aqi));
  if (i.climate) out.push(...heatRisk(i.climate));
  if (i.wiki) out.push(...floodKeywordRisk(i.wiki));
  if (i.elevation !== null && i.features) out.push(...coastalRisk(i.elevation, i.features));
  if (i.features) out.push(...servicesGapRisk(i.features));

  out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return out;
}
