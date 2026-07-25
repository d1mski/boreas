import { useEffect, useState } from 'react';
import type { Coordinates, ModuleState } from '../types';
import { initialModuleState } from '../types';
import { fetchJson } from '../utils/fetcher';
import { haversine } from '../utils/coordinates';
import { cacheGet, cacheSet, TTL } from '../utils/persistentCache';
import { createSharedMap, sharedFetch } from '../utils/sharedFetch';
import { sleep } from '../utils/sleep';
import { overpassGate } from './overpassGate';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
];

export type FeatureCategory =
  | 'amenity'
  | 'industrial'
  | 'airport'
  | 'water'
  | 'park'
  | 'place'
  | 'transit'
  | 'hazard'
  | 'military'
  | 'other';

export interface NearbyFeature {
  id: number;
  elementType: 'node' | 'way';
  category: FeatureCategory;
  subtype: string;
  name: string | null;
  lat: number;
  lon: number;
  distanceKm: number;
}

interface OverpassElement {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

const cache = new Map<string, NearbyFeature[]>();
const inflight = createSharedMap<NearbyFeature[]>();

const COORD_PRECISION = 2;

function quantize(coords: Coordinates): Coordinates {
  return {
    lat: Number(coords.lat.toFixed(COORD_PRECISION)),
    lon: Number(coords.lon.toFixed(COORD_PRECISION)),
  };
}

const QUERY_VERSION = 'v8'; // v8: drop unnamed hospitals (v7: no speciality demotion; v6: drop benches)

function makeKey(coords: Coordinates): string {
  return `${QUERY_VERSION}|${coords.lat.toFixed(COORD_PRECISION)}|${coords.lon.toFixed(COORD_PRECISION)}`;
}

function buildQuery(lat: number, lon: number): string {
  return `[out:json][timeout:50][maxsize:32000000];(
nwr["amenity"](around:3000,${lat},${lon});
nwr["shop"](around:2000,${lat},${lon});
nwr["public_transport"](around:3000,${lat},${lon});
node["highway"="bus_stop"](around:3000,${lat},${lon});
nwr["railway"~"^(station|halt|tram_stop)$"](around:8000,${lat},${lon});
nwr["harbour"="yes"](around:8000,${lat},${lon});
nwr["landuse"="harbour"](around:8000,${lat},${lon});
nwr["seamark:type"="harbour"](around:8000,${lat},${lon});
way["landuse"="industrial"](around:2500,${lat},${lon});
way["landuse"="commercial"](around:2500,${lat},${lon});
nwr["aeroway"="aerodrome"](around:12000,${lat},${lon});
way["natural"="water"](around:2000,${lat},${lon});
way["leisure"="park"](around:1500,${lat},${lon});
// power=substation: node-only is intentional — ways cause Overpass geometry explosion + timeout. Captures ~20% of substations (locked tradeoff).
node["power"="substation"](around:5000,${lat},${lon});
nwr["landuse"="military"](around:5000,${lat},${lon});
nwr["military"](around:5000,${lat},${lon});
nwr["man_made"="wastewater_plant"](around:5000,${lat},${lon});
nwr["landuse"="quarry"](around:5000,${lat},${lon});
nwr["landuse"="landfill"](around:5000,${lat},${lon});
nwr["telecom"="data_center"](around:5000,${lat},${lon});
nwr["leisure"="golf_course"](around:2000,${lat},${lon});
);out center tags;`;
}

function schoolSubtype(tags: Record<string, string>): string {
  const level = (tags['school:level'] ?? tags['isced:level'] ?? '').toLowerCase().trim();
  // TODO: multi-value levels ("1;2", "0-4") fall through to generic 'school' — future improvement.
  if (level === 'primary' || level === 'elementary' || level === '1') return 'school:primary';
  if (level === 'secondary' || level === 'high' || level === '2' || level === '3') return 'school:secondary';
  return 'school';
}

function categorise(tags: Record<string, string>): {
  category: FeatureCategory;
  subtype: string;
} {
  if (tags.aeroway === 'aerodrome') return { category: 'airport', subtype: 'aerodrome' };
  // Military gets its own category (not hazard) — bases/offices aren't inherently hazardous,
  // so they get a distinct colour and stay out of hazard severity/nearest-hazard scoring.
  if (tags.landuse === 'military' || tags.military) return { category: 'military', subtype: 'military' };
  // HAZ-01: hazard category — must precede landuse=industrial check
  if (tags.power === 'substation') return { category: 'hazard', subtype: 'substation' };
  if (tags.man_made === 'wastewater_plant') return { category: 'hazard', subtype: 'wastewater' };
  if (tags.landuse === 'quarry') return { category: 'hazard', subtype: 'quarry' };
  if (tags.landuse === 'landfill') return { category: 'hazard', subtype: 'landfill' };
  if (tags.telecom === 'data_center') return { category: 'hazard', subtype: 'data_center' };
  if (tags.landuse === 'industrial') return { category: 'industrial', subtype: 'industrial' };
  if (tags.landuse === 'commercial') return { category: 'industrial', subtype: 'commercial' };
  if (tags.landuse === 'harbour') return { category: 'transit', subtype: 'harbour' };
  if (tags.harbour === 'yes') return { category: 'transit', subtype: 'harbour' };
  if (tags['seamark:type'] === 'harbour') return { category: 'transit', subtype: 'harbour' };
  if (tags.amenity === 'ferry_terminal') return { category: 'transit', subtype: 'ferry_terminal' };
  if (tags.railway === 'station') return { category: 'transit', subtype: 'railway:station' };
  if (tags.railway === 'halt') return { category: 'transit', subtype: 'railway:halt' };
  if (tags.railway === 'tram_stop') return { category: 'transit', subtype: 'railway:tram_stop' };
  if (tags.highway === 'bus_stop') return { category: 'transit', subtype: 'bus_stop' };
  if (tags.natural === 'water') return { category: 'water', subtype: 'water' };
  if (tags.leisure === 'golf_course') return { category: 'park', subtype: 'golf_course' };
  if (tags.leisure === 'park') return { category: 'park', subtype: 'park' };
  // amenity=hospital is authoritative. Do NOT demote by healthcare:speciality —
  // major hospitals list many specialities (general;emergency;oncology;…), which
  // wrongly demoted real hospitals (e.g. Patras University Hospital) to 'clinic'
  // while unspecified specialist institutes stayed 'hospital'. Only an explicit
  // healthcare=clinic overrides.
  if (tags.amenity === 'hospital' || tags.healthcare === 'hospital') {
    if (tags.healthcare === 'clinic') return { category: 'amenity', subtype: 'clinic' };
    return { category: 'amenity', subtype: 'hospital' };
  }
  if (tags.amenity === 'clinic' || tags.amenity === 'doctors' || tags.healthcare === 'clinic') {
    return { category: 'amenity', subtype: 'clinic' };
  }
  if (tags.amenity === 'school') return { category: 'amenity', subtype: schoolSubtype(tags) };
  if (tags.public_transport === 'station') {
    return { category: 'transit', subtype: 'pt:station' };
  }
  if (tags.public_transport) return { category: 'transit', subtype: tags.public_transport };
  if (tags.amenity) return { category: 'amenity', subtype: tags.amenity };
  if (tags.shop) return { category: 'amenity', subtype: `shop:${tags.shop}` };
  return { category: 'other', subtype: 'other' };
}

async function tryEndpoint(
  url: string,
  query: string,
  signal: AbortSignal,
): Promise<OverpassResponse> {
  return fetchJson<OverpassResponse>(url, {
    signal,
    timeoutMs: 55000,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    },
  });
}

async function fetchFeatures(
  coords: Coordinates,
  signal: AbortSignal,
): Promise<NearbyFeature[]> {
  const query = buildQuery(coords.lat, coords.lon);
  let lastErr: unknown = null;
  for (let i = 0; i < ENDPOINTS.length; i++) {
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');
    const endpoint = ENDPOINTS[i];
    try {
      const data = await tryEndpoint(endpoint, query, signal);
      return interpret(coords, data);
    } catch (err) {
      if (signal.aborted) throw err;
      lastErr = err;
      // Abortable: an abandoned retry must not sleep through its backoff
      // still holding an overpassGate slot.
      await sleep(800 * (i + 1), signal);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Overpass unreachable');
}

// Subtypes too trivial to count as a "place nearby" — extend as needed.
const IRRELEVANT_SUBTYPES = new Set<string>(['bench']);

function interpret(coords: Coordinates, data: OverpassResponse): NearbyFeature[] {
  const out: NearbyFeature[] = [];
  for (const el of data.elements) {
    const tags = el.tags ?? {};
    if (Object.keys(tags).length === 0) continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat === undefined || lon === undefined) continue;
    const { category, subtype } = categorise(tags);
    if (category === 'other') continue;
    // Drop noise types that aren't meaningful "places nearby"
    if (IRRELEVANT_SUBTYPES.has(subtype)) continue;
    // Unnamed hospitals are OSM mistags/stubs (real hospitals are named) — drop
    // entirely so they don't appear as map pins, in counts, or as nearest-hospital.
    if (subtype === 'hospital' && !tags.name) continue;
    out.push({
      id: el.id,
      elementType: el.type,
      category,
      subtype,
      name: tags.name ?? null,
      lat,
      lon,
      distanceKm: haversine(coords, { lat, lon }) / 1000,
    });
  }
  out.sort((a, b) => a.distanceKm - b.distanceKm);
  return out;
}

export function useOverpassFeatures(
  coords: Coordinates | null,
): ModuleState<NearbyFeature[]> {
  const [state, setState] = useState<ModuleState<NearbyFeature[]>>(() =>
    initialModuleState<NearbyFeature[]>(),
  );

  const qLat = coords ? Number(coords.lat.toFixed(COORD_PRECISION)) : null;
  const qLon = coords ? Number(coords.lon.toFixed(COORD_PRECISION)) : null;

  useEffect(() => {
    if (!coords) {
      setState(initialModuleState<NearbyFeature[]>());
      return;
    }
    const qCoords = quantize(coords);
    const key = makeKey(qCoords);
    const cached = cache.get(key);
    if (cached) {
      setState({ status: 'success', data: cached, error: null });
      return;
    }

    let cancelled = false;
    // Set once the shared fetch is subscribed; releasing it aborts the
    // underlying request when this is the last subscriber (see sharedFetch).
    let release: (() => void) | null = null;
    setState({ status: 'loading', data: null, error: null });

    void (async () => {
      const persistent = await cacheGet<NearbyFeature[]>(key);
      if (cancelled) return;
      if (persistent) {
        cache.set(key, persistent);
        setState({ status: 'success', data: persistent, error: null });
        return;
      }

      const sub = sharedFetch(inflight, key, (signal) =>
        overpassGate.run(async () => {
          if (signal.aborted) throw new DOMException('aborted', 'AbortError');
          const features = await fetchFeatures(qCoords, signal);
          cache.set(key, features);
          void cacheSet(key, features, TTL.overpassFeatures);
          return features;
        }),
      );
      release = sub.release;
      sub.promise
        .then((features) => {
          if (cancelled) return;
          setState({ status: 'success', data: features, error: null });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          if (err instanceof DOMException && err.name === 'AbortError') return;
          const message = err instanceof Error ? err.message : String(err);
          setState({ status: 'error', data: null, error: message });
        });
    })();

    return () => {
      cancelled = true;
      release?.();
    };
  }, [qLat, qLon]);

  return state;
}

const NEAREST_ROWS: Array<{ label: string; match: (f: NearbyFeature) => boolean }> = [
  { label: 'hospital', match: (f) => f.subtype === 'hospital' },
  { label: 'pharmacy', match: (f) => f.subtype === 'pharmacy' },
  {
    label: 'supermarket',
    match: (f) => f.subtype === 'shop:supermarket' || f.subtype === 'supermarket',
  },
  { label: 'kindergarten', match: (f) => f.subtype === 'kindergarten' },
  { label: 'primary school', match: (f) => f.subtype === 'school:primary' },
  {
    label: 'high school',
    match: (f) => f.subtype === 'school:secondary' || f.subtype === 'school',
  },
  {
    label: 'university',
    match: (f) => f.subtype === 'university' || f.subtype === 'college',
  },
  { label: 'bus stop', match: (f) => f.subtype === 'bus_stop' || f.subtype === 'platform' },
  {
    label: 'train station',
    match: (f) =>
      f.subtype === 'railway:station' ||
      f.subtype === 'railway:halt' ||
      f.subtype === 'pt:station',
  },
  { label: 'tram stop', match: (f) => f.subtype === 'railway:tram_stop' },
  {
    label: 'port / ferry',
    match: (f) => f.subtype === 'ferry_terminal' || f.subtype === 'harbour',
  },
  { label: 'military', match: (f) => f.subtype === 'military' },
  { label: 'substation', match: (f) => f.subtype === 'substation' },
  { label: 'wastewater plant', match: (f) => f.subtype === 'wastewater' },
  { label: 'quarry / landfill', match: (f) => f.subtype === 'quarry' || f.subtype === 'landfill' },
  { label: 'data center', match: (f) => f.subtype === 'data_center' },
];

export function nearestByType(
  features: NearbyFeature[],
): Array<{ label: string; feature: NearbyFeature | null }> {
  return NEAREST_ROWS.map(({ label, match }) => ({
    label,
    feature: features.find(match) ?? null,
  }));
}
