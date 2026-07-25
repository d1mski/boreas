import { useEffect, useState } from 'react';
import type { Coordinates, EarthquakeEvent, ModuleState } from '../types';
import { initialModuleState } from '../types';
import { fetchJson } from '../utils/fetcher';
import { haversine } from '../utils/coordinates';
import { cacheGet, cacheSet, TTL } from '../utils/persistentCache';
import { createSharedMap, sharedFetch } from '../utils/sharedFetch';

const BASE = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

interface USGSFeature {
  id: string;
  properties: {
    mag: number | null;
    place: string | null;
    time: number | null;
  };
  geometry: {
    coordinates: [number, number, number];
  };
}

interface USGSResponse {
  features: USGSFeature[];
}

const cache = new Map<string, EarthquakeEvent[]>();
const inflight = createSharedMap<EarthquakeEvent[]>();

function makeKey(coords: Coordinates): string {
  return `${coords.lat.toFixed(3)}|${coords.lon.toFixed(3)}`;
}

function buildUrl(coords: Coordinates): string {
  const end = new Date();
  end.setDate(end.getDate() + 1); // USGS reads bare dates as 00:00 UTC — exclusive of today without this
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 10);
  const params = new URLSearchParams({
    format: 'geojson',
    latitude: coords.lat.toString(),
    longitude: coords.lon.toString(),
    maxradiuskm: '100',
    starttime: start.toISOString().slice(0, 10),
    endtime: end.toISOString().slice(0, 10),
    minmagnitude: '3.0',
    orderby: 'magnitude',
    limit: '200',
  });
  return `${BASE}?${params.toString()}`;
}

async function fetchEvents(
  coords: Coordinates,
  signal: AbortSignal,
): Promise<EarthquakeEvent[]> {
  const url = buildUrl(coords);
  const data = await fetchJson<USGSResponse>(url, { signal, timeoutMs: 20000 });
  const events: EarthquakeEvent[] = [];
  for (const f of data.features) {
    const [lon, lat, depth] = f.geometry.coordinates;
    const mag = f.properties.mag;
    const time = f.properties.time;
    if (mag === null || time === null) continue;
    events.push({
      id: f.id,
      magnitude: mag,
      depth,
      distanceKm: haversine(coords, { lat, lon }) / 1000,
      date: new Date(time).toISOString(),
      place: f.properties.place ?? '',
      lat,
      lon,
    });
  }
  return events;
}

export function useEarthquakes(
  coords: Coordinates | null,
): ModuleState<EarthquakeEvent[]> {
  const [state, setState] = useState<ModuleState<EarthquakeEvent[]>>(() =>
    initialModuleState<EarthquakeEvent[]>(),
  );

  useEffect(() => {
    if (!coords) {
      setState(initialModuleState<EarthquakeEvent[]>());
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
      const persistent = await cacheGet<EarthquakeEvent[]>(key);
      if (cancelled) return;
      if (persistent) {
        cache.set(key, persistent);
        setState({ status: 'success', data: persistent, error: null });
        return;
      }

      const sub = sharedFetch(inflight, key, (signal) => fetchEvents(coords, signal));
      release = sub.release;
      sub.promise
        .then((events) => {
          if (cancelled) return;
          cache.set(key, events);
          void cacheSet(key, events, TTL.earthquakes);
          setState({ status: 'success', data: events, error: null });
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
