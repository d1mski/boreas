import { useEffect, useState } from 'react';
import type { AqiSample, Coordinates, ModuleState } from '../types';
import { initialModuleState } from '../types';
import { fetchJson } from '../utils/fetcher';
import { cacheGet, cacheSet, TTL } from '../utils/persistentCache';
import { createSharedMap, sharedFetch } from '../utils/sharedFetch';

const BASE = 'https://air-quality-api.open-meteo.com/v1/air-quality';

const HOURLY_VARS = [
  'european_aqi',
  'pm10',
  'pm2_5',
  'nitrogen_dioxide',
  'ozone',
  'alder_pollen',
  'birch_pollen',
  'grass_pollen',
  'mugwort_pollen',
  'olive_pollen',
  'ragweed_pollen',
];

interface AirQualityResponse {
  hourly: {
    time: string[];
    european_aqi: number[];
    pm10: number[];
    pm2_5: number[];
    nitrogen_dioxide: number[];
    ozone: number[];
    alder_pollen: (number | null)[];
    birch_pollen: (number | null)[];
    grass_pollen: (number | null)[];
    mugwort_pollen: (number | null)[];
    olive_pollen: (number | null)[];
    ragweed_pollen: (number | null)[];
  };
}

const cache = new Map<string, AqiSample[]>();
const inflight = createSharedMap<AqiSample[]>();

function makeKey(coords: Coordinates): string {
  return `aqv2|${coords.lat.toFixed(4)}|${coords.lon.toFixed(4)}`;
}

function buildUrl(coords: Coordinates): string {
  const params = new URLSearchParams({
    latitude: coords.lat.toString(),
    longitude: coords.lon.toString(),
    hourly: HOURLY_VARS.join(','),
    past_days: '92',
    timezone: 'auto',
  });
  return `${BASE}?${params.toString()}`;
}

async function fetchAqi(
  coords: Coordinates,
  signal: AbortSignal,
): Promise<AqiSample[]> {
  const url = buildUrl(coords);
  const raw = await fetchJson<AirQualityResponse>(url, { signal, timeoutMs: 20000 });
  const { time, european_aqi, pm10, pm2_5, nitrogen_dioxide, ozone, alder_pollen, birch_pollen, grass_pollen, mugwort_pollen, olive_pollen, ragweed_pollen } = raw.hourly;
  const samples: AqiSample[] = [];
  for (let i = 0; i < time.length; i++) {
    samples.push({
      time: time[i],
      europeanAqi: european_aqi[i] ?? null,
      pm10: pm10[i] ?? null,
      pm25: pm2_5[i] ?? null,
      no2: nitrogen_dioxide[i] ?? null,
      o3: ozone[i] ?? null,
      alderPollen: alder_pollen[i] ?? null,
      birchPollen: birch_pollen[i] ?? null,
      grassPollen: grass_pollen[i] ?? null,
      mugwortPollen: mugwort_pollen[i] ?? null,
      olivePollen: olive_pollen[i] ?? null,
      ragweedPollen: ragweed_pollen[i] ?? null,
    });
  }
  return samples;
}

export function useAirQuality(
  coords: Coordinates | null,
): ModuleState<AqiSample[]> {
  const [state, setState] = useState<ModuleState<AqiSample[]>>(() =>
    initialModuleState<AqiSample[]>(),
  );

  useEffect(() => {
    if (!coords) {
      setState(initialModuleState<AqiSample[]>());
      return;
    }
    const key = makeKey(coords);
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
      const persistent = await cacheGet<AqiSample[]>(key);
      if (cancelled) return;
      if (persistent) {
        cache.set(key, persistent);
        setState({ status: 'success', data: persistent, error: null });
        return;
      }

      const sub = sharedFetch(inflight, key, (signal) => fetchAqi(coords, signal));
      release = sub.release;
      sub.promise
        .then((samples) => {
          if (cancelled) return;
          cache.set(key, samples);
          void cacheSet(key, samples, TTL.openMeteoAirQuality);
          setState({ status: 'success', data: samples, error: null });
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
