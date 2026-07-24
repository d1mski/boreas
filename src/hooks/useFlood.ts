// src/hooks/useFlood.ts
// Pattern mirrors useAirQuality.ts exactly — verified 2026-06-22
// No-river behavior: desert → HTTP 200 all-zeros; ocean → HTTP 200 all-nulls
// No HTTP 400 case detected — both return 200 (unlike Marine API in Phase 10)

import { useEffect, useState } from 'react';
import type { Coordinates, ModuleState } from '../types';
import { initialModuleState } from '../types';
import { fetchJson } from '../utils/fetcher';
import { cacheGet, cacheSet, TTL } from '../utils/persistentCache';
import { createSharedMap, sharedFetch } from '../utils/sharedFetch';

const BASE = 'https://flood-api.open-meteo.com/v1/flood';
const DAILY_VARS = ['river_discharge', 'river_discharge_p25', 'river_discharge_p75'];

export interface FloodSample {
  time: string;
  riverDischarge: number | null;  // m³/s; null = ocean/uncovered; 0 = desert/no-river-in-5km
  p25: number | null;
  p75: number | null;
}

interface FloodResponse {
  daily: {
    time: string[];
    river_discharge: (number | null)[];
    river_discharge_p25: (number | null)[];
    river_discharge_p75: (number | null)[];
  };
}

const cache = new Map<string, FloodSample[]>();
// Separate sentinel for not-applicable to avoid null ambiguity
const notApplicableCache = new Set<string>();
const inflight = createSharedMap<FloodFetchResult>();

function makeKey(coords: Coordinates): string {
  return `flood|${coords.lat.toFixed(4)}|${coords.lon.toFixed(4)}`;
}

function buildUrl(coords: Coordinates): string {
  const params = new URLSearchParams({
    latitude: coords.lat.toString(),
    longitude: coords.lon.toString(),
    daily: DAILY_VARS.join(','),
    past_days: '92',
  });
  return `${BASE}?${params.toString()}`;
}

export function isNotApplicable(discharge: (number | null)[]): boolean {
  // Desert case: all zeros. Ocean case: all nulls. Both = not-applicable.
  return discharge.every(v => v === null || v === 0);
}

type FloodFetchResult =
  | { notApplicable: true }
  | { notApplicable: false; samples: FloodSample[] };

// Fetch + not-applicable classification run together behind the shared
// in-flight promise so concurrent subscribers see one network request and
// one classification pass (see sharedFetch).
async function fetchAndClassify(
  coords: Coordinates,
  signal: AbortSignal,
): Promise<FloodFetchResult> {
  const url = buildUrl(coords);
  const raw = await fetchJson<FloodResponse>(url, { signal, timeoutMs: 20000 });

  if (isNotApplicable(raw.daily.river_discharge)) {
    return { notApplicable: true };
  }

  const samples: FloodSample[] = raw.daily.time.map((t, i) => ({
    time: t,
    riverDischarge: raw.daily.river_discharge[i],
    p25: raw.daily.river_discharge_p25[i],
    p75: raw.daily.river_discharge_p75[i],
  }));
  return { notApplicable: false, samples };
}

export function useFlood(
  coords: Coordinates | null,
): ModuleState<FloodSample[]> & { notApplicable: boolean } {
  const [state, setState] = useState<ModuleState<FloodSample[]>>(
    () => initialModuleState<FloodSample[]>(),
  );
  const [notApplicable, setNotApplicable] = useState(false);

  useEffect(() => {
    if (!coords) {
      setState(initialModuleState<FloodSample[]>());
      setNotApplicable(false);
      return;
    }
    const key = makeKey(coords);

    if (notApplicableCache.has(key)) {
      setState({ status: 'success', data: [], error: null });
      setNotApplicable(true);
      return;
    }
    const cached = cache.get(key);
    if (cached) {
      setState({ status: 'success', data: cached, error: null });
      setNotApplicable(false);
      return;
    }

    let cancelled = false;
    // Set once the shared fetch is subscribed; releasing it aborts the
    // underlying request when this is the last subscriber (see sharedFetch).
    let release: (() => void) | null = null;
    setState({ status: 'loading', data: null, error: null });
    setNotApplicable(false);

    void (async () => {
      // Check persistent cache
      const persistent = await cacheGet<FloodSample[] | 'not-applicable'>(key);
      if (cancelled) return;
      if (persistent === 'not-applicable') {
        notApplicableCache.add(key);
        setState({ status: 'success', data: [], error: null });
        setNotApplicable(true);
        return;
      }
      if (persistent) {
        cache.set(key, persistent);
        setState({ status: 'success', data: persistent, error: null });
        return;
      }

      const sub = sharedFetch(inflight, key, (signal) => fetchAndClassify(coords, signal));
      release = sub.release;
      sub.promise
        .then((result) => {
          if (cancelled) return;
          if (result.notApplicable) {
            // Sentinel is a successful result — genuinely no river within
            // range, not a failure — so it caches like any other success.
            notApplicableCache.add(key);
            void cacheSet(key, 'not-applicable', TTL.openMeteoFlood);
            setState({ status: 'success', data: [], error: null });
            setNotApplicable(true);
            return;
          }
          cache.set(key, result.samples);
          void cacheSet(key, result.samples, TTL.openMeteoFlood);
          setState({ status: 'success', data: result.samples, error: null });
          setNotApplicable(false);
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

  return { ...state, notApplicable };
}
