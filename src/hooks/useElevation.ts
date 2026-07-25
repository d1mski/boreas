import { useEffect, useRef, useState } from 'react';
import type { Coordinates } from '../types';
import { fetchJson } from '../utils/fetcher';
import { cacheGet, cacheSet, TTL } from '../utils/persistentCache';

interface ElevationResponse {
  elevation: number[];
}

const cache = new Map<string, number>();

export interface ElevationState {
  elevation: number | null;
  loading: boolean;
}

export function useElevation(coords: Coordinates | null): ElevationState {
  const [elevation, setElevation] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!coords) {
      setElevation(null);
      setLoading(false);
      return;
    }
    const key = `${coords.lat.toFixed(4)}|${coords.lon.toFixed(4)}`;
    const cached = cache.get(key);
    if (cached !== undefined) {
      setElevation(cached);
      setLoading(false);
      return;
    }

    controllerRef.current?.abort();
    const ctrl = new AbortController();
    controllerRef.current = ctrl;
    setElevation(null); // pin B must never render/score with pin A's elevation while its own fetch is pending
    setLoading(true);

    void (async () => {
      const persistent = await cacheGet<number>(`elevation:${key}`);
      if (ctrl.signal.aborted) return;
      if (persistent !== null) {
        cache.set(key, persistent);
        setElevation(persistent);
        setLoading(false);
        return;
      }
      const url = `https://api.open-meteo.com/v1/elevation?latitude=${coords.lat}&longitude=${coords.lon}`;
      try {
        const data = await fetchJson<ElevationResponse>(url, {
          signal: ctrl.signal,
          timeoutMs: 10000,
        });
        if (ctrl.signal.aborted) return;
        const elev = Array.isArray(data.elevation) ? data.elevation[0] : null;
        if (Number.isFinite(elev as number)) {
          cache.set(key, elev as number);
          void cacheSet(`elevation:${key}`, elev as number, TTL.elevation);
          setElevation(elev as number);
        } else {
          setElevation(null);
        }
        setLoading(false);
      } catch (err: unknown) {
        if (ctrl.signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setElevation(null);
        setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [coords?.lat, coords?.lon]);

  return { elevation, loading };
}
