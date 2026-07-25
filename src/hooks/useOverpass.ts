import { useEffect, useState } from 'react';
import type { BuildingData, Coordinates, ModuleState } from '../types';
import { initialModuleState } from '../types';
import { fetchJson } from '../utils/fetcher';
import { analyseBuildingPolygon, emptyBuilding } from '../utils/buildingOrientation';
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

interface OverpassWay {
  type: 'way';
  id: number;
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
}

function bearingBetween(from: Coordinates, to: Coordinates): number {
  const dLon = ((to.lon - from.lon) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

interface OverpassElement {
  type: string;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

const cache = new Map<string, BuildingData>();
const inflight = createSharedMap<BuildingData>();

const COORD_PRECISION = 5;

function quantize(coords: Coordinates): Coordinates {
  return {
    lat: Number(coords.lat.toFixed(COORD_PRECISION)),
    lon: Number(coords.lon.toFixed(COORD_PRECISION)),
  };
}

const KEY_VERSION = 'v2';

function makeKey(coords: Coordinates): string {
  return `${KEY_VERSION}|${coords.lat.toFixed(COORD_PRECISION)}|${coords.lon.toFixed(COORD_PRECISION)}`;
}

async function fetchFromEndpoint(
  url: string,
  query: string,
  signal: AbortSignal,
): Promise<OverpassResponse> {
  return fetchJson<OverpassResponse>(url, {
    signal,
    timeoutMs: 20000,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    },
  });
}

const SEARCH_RADIUS_M = 400;
const ROAD_RADIUS_M = 600;
const ROAD_HIGHWAY_FILTER = '^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|pedestrian)$';

function buildQuery(coords: Coordinates): string {
  return (
    `[out:json][timeout:20];(` +
    `way["building"](around:${SEARCH_RADIUS_M},${coords.lat},${coords.lon});` +
    `way["building:part"](around:${SEARCH_RADIUS_M},${coords.lat},${coords.lon});` +
    `way["highway"~"${ROAD_HIGHWAY_FILTER}"](around:${ROAD_RADIUS_M},${coords.lat},${coords.lon});` +
    `);out body geom qt;`
  );
}

async function fetchBuilding(
  coords: Coordinates,
  signal: AbortSignal,
): Promise<BuildingData> {
  const query = buildQuery(coords);

  let lastErr: unknown = null;
  for (let i = 0; i < ENDPOINTS.length; i++) {
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');
    const endpoint = ENDPOINTS[i];
    try {
      const data = await fetchFromEndpoint(endpoint, query, signal);
      return interpretResponse(coords, data);
    } catch (err) {
      if (signal.aborted) throw err;
      lastErr = err;
      // Abortable: an abandoned retry must not sleep through its backoff
      // still holding an overpassGate slot.
      await sleep(800 * (i + 1), signal);
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error('Overpass unreachable');
}

function interpretResponse(
  query: Coordinates,
  data: OverpassResponse,
): BuildingData {
  const allWays = data.elements.filter(
    (e): e is OverpassWay =>
      e.type === 'way' &&
      Array.isArray((e as OverpassWay).geometry) &&
      ((e as OverpassWay).geometry?.length ?? 0) >= 2,
  );
  const buildings = allWays.filter((w) => {
    if ((w.geometry?.length ?? 0) < 3) return false;
    const t = w.tags ?? {};
    return Boolean(t.building || t['building:part']);
  });
  const highways = allWays.filter((w) => Boolean(w.tags?.highway));

  if (buildings.length === 0) return emptyBuilding();

  let best: OverpassWay | null = null;
  let bestDist = Infinity;
  let bestCentroid: Coordinates | null = null;
  for (const way of buildings) {
    const geom = way.geometry ?? [];
    let latSum = 0;
    let lonSum = 0;
    for (const p of geom) {
      latSum += p.lat;
      lonSum += p.lon;
    }
    const centroid = { lat: latSum / geom.length, lon: lonSum / geom.length };
    const d = haversine(query, centroid);
    if (d < bestDist) {
      bestDist = d;
      best = way;
      bestCentroid = centroid;
    }
  }

  if (!best || !best.geometry || !bestCentroid) return emptyBuilding();

  let entranceBearing: number | null = null;
  let nearestRoadDist = Infinity;
  for (const road of highways) {
    const geom = road.geometry ?? [];
    for (const node of geom) {
      const d = haversine(bestCentroid, { lat: node.lat, lon: node.lon });
      if (d < nearestRoadDist) {
        nearestRoadDist = d;
        entranceBearing = bearingBetween(bestCentroid, {
          lat: node.lat,
          lon: node.lon,
        });
      }
    }
  }

  const polygon: Coordinates[] = best.geometry.map((g) => ({
    lat: g.lat,
    lon: g.lon,
  }));
  const analysis = analyseBuildingPolygon(polygon, { entranceBearing });

  const levelsTag = best.tags?.['building:levels'];
  const parsedLevels = levelsTag ? parseInt(levelsTag, 10) : NaN;
  const rawType = best.tags?.building ?? best.tags?.['building:part'];
  const type = rawType && rawType !== 'yes' ? rawType : null;

  return {
    found: true,
    polygon: analysis.polygon,
    areaSqm: analysis.areaSqm,
    levels: Number.isFinite(parsedLevels) ? parsedLevels : null,
    type,
    longestEdgeBearing: analysis.longestEdgeBearing,
    facades: analysis.facades,
    matchDistanceM: bestDist,
  };
}

export function useOverpassBuilding(
  coords: Coordinates | null,
): ModuleState<BuildingData> {
  const [state, setState] = useState<ModuleState<BuildingData>>(() =>
    initialModuleState<BuildingData>(),
  );

  const qLat = coords ? Number(coords.lat.toFixed(COORD_PRECISION)) : null;
  const qLon = coords ? Number(coords.lon.toFixed(COORD_PRECISION)) : null;

  useEffect(() => {
    if (!coords) {
      setState(initialModuleState<BuildingData>());
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
      const persistent = await cacheGet<BuildingData>(key);
      if (cancelled) return;
      if (persistent) {
        cache.set(key, persistent);
        setState({ status: 'success', data: persistent, error: null });
        return;
      }

      const sub = sharedFetch(inflight, key, (signal) =>
        overpassGate.run(async () => {
          if (signal.aborted) throw new DOMException('aborted', 'AbortError');
          const data = await fetchBuilding(qCoords, signal);
          cache.set(key, data);
          void cacheSet(key, data, TTL.overpassBuilding);
          return data;
        }),
      );
      release = sub.release;
      sub.promise
        .then((data) => {
          if (cancelled) return;
          setState({ status: 'success', data, error: null });
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
