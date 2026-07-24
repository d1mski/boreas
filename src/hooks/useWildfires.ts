import { useEffect, useState } from 'react';
import type { Coordinates, ModuleState, WildfireEvent } from '../types';
import { initialModuleState } from '../types';
import { fetchJson } from '../utils/fetcher';
import { haversine } from '../utils/coordinates';
import { cacheGet, cacheSet } from '../utils/persistentCache';
import { createSharedMap, sharedFetch } from '../utils/sharedFetch';

const EONET_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events';
const FIRMS_URL = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
const FIRMS_MAP_KEY = import.meta.env.VITE_FIRMS_MAP_KEY ?? '';
const FIRMS_SOURCE = 'VIIRS_SNPP_NRT';
const FIRMS_DAY_RANGE = 5; // FIRMS VIIRS NRT area API max is 5; >5 returns HTTP 400
// EONET leaves wildfires "open" for years; only show genuinely recent activity.
const EONET_MAX_AGE_DAYS = 30;
const EONET_MAX_AGE_MS = EONET_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
const BBOX_HALF_DEG = 2.0;
const WILDFIRE_TTL_MS = 6 * 60 * 60 * 1000;

function bbox(coords: Coordinates) {
  return {
    minLon: coords.lon - BBOX_HALF_DEG,
    minLat: coords.lat - BBOX_HALF_DEG,
    maxLon: coords.lon + BBOX_HALF_DEG,
    maxLat: coords.lat + BBOX_HALF_DEG,
  };
}

interface EonetGeometry {
  date: string;
  type: 'Point' | 'Polygon';
  coordinates: number[] | number[][][];
  magnitudeValue?: number;
  magnitudeUnit?: string;
}

interface EonetEvent {
  id: string;
  title: string;
  categories: Array<{ id: string; title: string }>;
  geometry: EonetGeometry[];
}

interface EonetResponse {
  events: EonetEvent[];
}

function pointFromCoords(coords: number[]): { lat: number; lon: number } {
  return { lon: coords[0], lat: coords[1] };
}

async function fetchEonet(
  center: Coordinates,
  signal: AbortSignal,
): Promise<WildfireEvent[]> {
  const b = bbox(center);
  // EONET bbox order: W,N,E,S
  const bboxStr = `${b.minLon},${b.maxLat},${b.maxLon},${b.minLat}`;
  const url = `${EONET_URL}?category=wildfires&status=open&bbox=${bboxStr}&limit=50`;
  const res = await fetchJson<EonetResponse>(url, { signal, timeoutMs: 15000 });
  const out: WildfireEvent[] = [];
  for (const ev of res.events) {
    const latest = ev.geometry[ev.geometry.length - 1];
    if (!latest) continue;

    // EONET keeps old fires "open" indefinitely; drop anything not recently active.
    const ageMs = Date.now() - new Date(latest.date).getTime();
    if (!Number.isFinite(ageMs) || ageMs > EONET_MAX_AGE_MS) continue;

    let lat: number;
    let lon: number;
    let polygon: Coordinates[] | null = null;

    if (latest.type === 'Point') {
      const p = pointFromCoords(latest.coordinates as number[]);
      lat = p.lat;
      lon = p.lon;
    } else if (latest.type === 'Polygon') {
      const rings = latest.coordinates as number[][][];
      if (!rings[0] || rings[0].length < 3) continue;
      polygon = rings[0].map((c) => ({ lat: c[1], lon: c[0] }));
      // Centroid for distance calc
      let sumLat = 0;
      let sumLon = 0;
      for (const p of polygon) {
        sumLat += p.lat;
        sumLon += p.lon;
      }
      lat = sumLat / polygon.length;
      lon = sumLon / polygon.length;
    } else {
      continue;
    }

    out.push({
      id: `eonet:${ev.id}`,
      source: 'EONET',
      title: ev.title,
      lat,
      lon,
      date: latest.date,
      distanceKm: haversine(center, { lat, lon }) / 1000,
      magnitudeValue: latest.magnitudeValue ?? null,
      magnitudeUnit: latest.magnitudeUnit ?? null,
      brightness: null,
      confidence: null,
      frp: null,
      polygon,
    });
  }
  return out;
}

// FIRMS acq_time is "HMM"/"HHMM" UTC with no colon — "512" means 05:12.
// Raw interpolation produced "2026-07-20T0512" = Invalid Date, which made
// every FIRMS detection fail the recency filters in severity scoring.
function firmsIsoDate(acqDate: string | undefined, acqTime: string | undefined): string {
  if (!acqDate) return '';
  const t = (acqTime ?? '0').padStart(4, '0');
  return `${acqDate}T${t.slice(0, 2)}:${t.slice(2, 4)}:00Z`;
}

export function parseFirmsCsv(text: string, center: Coordinates): WildfireEvent[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((s) => s.trim());
  const latIdx = header.indexOf('latitude');
  const lonIdx = header.indexOf('longitude');
  if (latIdx < 0 || lonIdx < 0) return [];
  const brightIdx =
    header.indexOf('bright_ti4') >= 0 ? header.indexOf('bright_ti4') : header.indexOf('brightness');
  const confIdx = header.indexOf('confidence');
  const dateIdx = header.indexOf('acq_date');
  const timeIdx = header.indexOf('acq_time');
  const frpIdx = header.indexOf('frp');

  const out: WildfireEvent[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const lat = parseFloat(parts[latIdx]);
    const lon = parseFloat(parts[lonIdx]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({
      id: `firms:${lat.toFixed(4)}:${lon.toFixed(4)}:${parts[dateIdx] ?? ''}:${parts[timeIdx] ?? ''}`,
      source: 'FIRMS',
      title: null,
      lat,
      lon,
      date: dateIdx >= 0 ? firmsIsoDate(parts[dateIdx], parts[timeIdx]) : '',
      distanceKm: haversine(center, { lat, lon }) / 1000,
      magnitudeValue: null,
      magnitudeUnit: null,
      brightness: brightIdx >= 0 ? parseFloat(parts[brightIdx]) : null,
      confidence: confIdx >= 0 ? parts[confIdx] ?? null : null,
      frp: frpIdx >= 0 ? parseFloat(parts[frpIdx]) : null,
      polygon: null,
    });
  }
  return out;
}

async function fetchFirms(
  center: Coordinates,
  signal: AbortSignal,
): Promise<WildfireEvent[]> {
  if (!FIRMS_MAP_KEY) return [];
  const b = bbox(center);
  // FIRMS area order: W,S,E,N
  const areaStr = `${b.minLon},${b.minLat},${b.maxLon},${b.maxLat}`;
  const url = `${FIRMS_URL}/${FIRMS_MAP_KEY}/${FIRMS_SOURCE}/${areaStr}/${FIRMS_DAY_RANGE}`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`FIRMS HTTP ${res.status}`);
  return parseFirmsCsv(await res.text(), center);
}

interface CachedWildfires {
  events: WildfireEvent[];
  failedSources: string[];
}

// Memory cache keeps failedSources so the degraded marker survives
// same-session cache hits (a partial result must never be re-served as
// clean on a later mount). IDB stores bare WildfireEvent[] and only ever
// receives full successes, so hydration from IDB is always clean.
const cache = new Map<string, CachedWildfires>();
const inflight = createSharedMap<CachedWildfires>();

// Single constructor for success state from a cached/fetched entry — every
// success path (memory hit, IDB hit, live fetch) goes through this so the
// degraded marker cannot be dropped by one path rebuilding state by hand.
export function stateFromCached(entry: CachedWildfires): ModuleState<WildfireEvent[]> {
  return {
    status: 'success',
    data: entry.events,
    error: entry.failedSources.length > 0 ? `${entry.failedSources.join('+')} unavailable` : null,
  };
}

function makeKey(coords: Coordinates): string {
  return `wildfire:${coords.lat.toFixed(3)}|${coords.lon.toFixed(3)}`;
}

async function fetchAll(
  coords: Coordinates,
  signal: AbortSignal,
): Promise<{ events: WildfireEvent[]; failedSources: string[] }> {
  const [eonet, firms] = await Promise.allSettled([
    fetchEonet(coords, signal),
    fetchFirms(coords, signal),
  ]);
  if (signal.aborted) throw new DOMException('aborted', 'AbortError');
  const failedSources: string[] = [];
  const lists: WildfireEvent[][] = [];
  if (eonet.status === 'fulfilled') lists.push(eonet.value); else failedSources.push('EONET');
  if (firms.status === 'fulfilled') lists.push(firms.value); else failedSources.push('FIRMS');
  if (failedSources.length === 2) {
    throw new Error('Wildfire sources unavailable (EONET + FIRMS failed)');
  }
  const seen = new Set<string>();
  const merged: WildfireEvent[] = [];
  for (const ev of lists.flat()) {
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    merged.push(ev);
  }
  merged.sort((a, b) => a.distanceKm - b.distanceKm);
  return { events: merged, failedSources };
}

export function useWildfires(
  coords: Coordinates | null,
): ModuleState<WildfireEvent[]> {
  const [state, setState] = useState<ModuleState<WildfireEvent[]>>(() =>
    initialModuleState<WildfireEvent[]>(),
  );

  useEffect(() => {
    if (!coords) {
      setState(initialModuleState<WildfireEvent[]>());
      return;
    }
    const key = makeKey(coords);
    const cached = cache.get(key);
    if (cached) {
      setState(stateFromCached(cached));
      return;
    }

    let cancelled = false;
    // Set once the shared fetch is subscribed; releasing it aborts the
    // underlying request when this is the last subscriber (see sharedFetch).
    let release: (() => void) | null = null;
    setState({ status: 'loading', data: null, error: null });

    void (async () => {
      const persistent = await cacheGet<WildfireEvent[]>(key);
      if (cancelled) return;
      if (persistent) {
        // IDB only ever holds full successes; hydrate as clean.
        const entry: CachedWildfires = { events: persistent, failedSources: [] };
        cache.set(key, entry);
        setState(stateFromCached(entry));
        return;
      }

      const sub = sharedFetch(inflight, key, (signal) => fetchAll(coords, signal));
      release = sub.release;
      sub.promise
        .then(({ events, failedSources }) => {
          if (cancelled) return;
          const entry: CachedWildfires = { events, failedSources };
          // Memory cache keeps the degraded marker. Partial results are
          // session-memory only — NEVER IDB — so a transient outage can't
          // poison the persistent cache with a false empty.
          cache.set(key, entry);
          if (failedSources.length === 0) {
            void cacheSet(key, events, WILDFIRE_TTL_MS);
          }
          setState(stateFromCached(entry));
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
  }, [coords?.lat, coords?.lon]);

  return state;
}
