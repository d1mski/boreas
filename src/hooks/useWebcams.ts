// src/hooks/useWebcams.ts
// WARNING: VITE_WINDY_KEY is exposed in the JS bundle.
// Mitigated by domain-restricting the key at api.windy.com/keys dashboard (see plan 09-01).
// Accepted under the no-backend constraint (see REQUIREMENTS.md Out of Scope).
const WINDY_KEY = import.meta.env.VITE_WINDY_KEY ?? '';
const BASE = 'https://api.windy.com/webcams/api/v3/webcams';
const WEBCAM_RADIUS_KM = 25;
const WEBCAM_LIMIT = 6;
const WEBCAM_TTL_MS = 8 * 60 * 1000; // 8 min — image tokens valid ~15 min on free tier; conservative buffer

import { useEffect, useRef, useState } from 'react';
import type { Coordinates, ModuleState } from '../types';
import { initialModuleState } from '../types';
import { fetchJson } from '../utils/fetcher';
import { haversine } from '../utils/coordinates';

export interface WindyWebcam {
  webcamId: number;
  title: string;
  status: string;
  lastUpdatedOn: string;
  thumbnailUrl: string;       // images.daylight.thumbnail (always lit) — fallback: images.current.thumbnail
  playerDayUrl: string;       // player.day — always present timelapse iframe
  playerLiveUrl: string | null; // player.live — present only if camera has livestream; usually absent
  detailUrl: string;          // urls.detail — click target (windy.com page)
  lat: number;                // location.latitude
  lon: number;                // location.longitude
  city: string;               // location.city
  distanceKm: number;         // computed client-side via haversine
}

// Loosely typed to match the live API response — only fields we access are typed
interface WindyApiResponse {
  total?: number;
  webcams?: Array<{
    webcamId: number;
    title: string;
    status: string;
    lastUpdatedOn: string;
    images?: {
      current?: { thumbnail?: string };
      daylight?: { thumbnail?: string };
    };
    player?: { day?: string; live?: string };
    urls?: { detail?: string };
    // location is required — always included when include=location; always present in tested responses
    location: { city?: string; latitude: number; longitude: number };
  }>;
}

// In-memory cache with timestamp for TTL enforcement — intentionally NOT idb
// Image URLs expire at ~15 min; persistent cache would serve broken images across sessions (CAM-01)
interface CacheEntry { data: WindyWebcam[]; fetchedAt: number }
const cache = new Map<string, CacheEntry>();

// Bridges a map-marker "view footage" click to the panel. When the Advanced panel is
// closed, it mounts AFTER the click, so the grid reads this on mount; the live
// 'settl-webcam-select' event covers the already-open case.
export const pendingWebcam: { id: number | null } = { id: null };

function makeKey(coords: Coordinates): string {
  return `webcams|${coords.lat.toFixed(3)}|${coords.lon.toFixed(3)}`;
}

function mapWebcam(
  w: NonNullable<WindyApiResponse['webcams']>[number],
  coords: Coordinates,
): WindyWebcam {
  return {
    webcamId: w.webcamId,
    title: w.title,
    status: w.status,
    lastUpdatedOn: w.lastUpdatedOn,
    // daylight thumbnail first — always shows a lit image; avoids black frames for night-side cameras
    thumbnailUrl: w.images?.daylight?.thumbnail ?? w.images?.current?.thumbnail ?? '',
    playerDayUrl: w.player?.day ?? '',
    playerLiveUrl: w.player?.live ?? null,
    detailUrl: w.urls?.detail ?? '',
    lat: w.location.latitude,
    lon: w.location.longitude,
    city: w.location?.city ?? 'unknown',
    // haversine returns METERS — divide by 1000 for km
    distanceKm: haversine(coords, { lat: w.location.latitude, lon: w.location.longitude }) / 1000,
  };
}

export function useWebcams(coords: Coordinates | null): ModuleState<WindyWebcam[]> {
  const [state, setState] = useState<ModuleState<WindyWebcam[]>>(
    () => initialModuleState<WindyWebcam[]>(),
  );
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Gate 1: no key configured — section absent, no fetch
    if (!WINDY_KEY) {
      setState(initialModuleState<WindyWebcam[]>());
      return;
    }
    // Gate 2: no coords — nothing to fetch
    if (!coords) {
      setState(initialModuleState<WindyWebcam[]>());
      return;
    }

    const key = makeKey(coords);

    // In-memory TTL check — not idb, intentionally short-lived (image URLs expire at ~15 min)
    const entry = cache.get(key);
    if (entry && Date.now() - entry.fetchedAt < WEBCAM_TTL_MS) {
      setState({ status: 'success', data: entry.data, error: null });
      return;
    }

    controllerRef.current?.abort();
    const ctrl = new AbortController();
    controllerRef.current = ctrl;
    setState({ status: 'loading', data: null, error: null });

    void (async () => {
      try {
        const params = new URLSearchParams({
          nearby: `${coords.lat},${coords.lon},${WEBCAM_RADIUS_KM}`,
          include: 'images,location,player,urls',
          limit: String(WEBCAM_LIMIT),
        });
        const url = `${BASE}?${params}`;
        const raw = await fetchJson<WindyApiResponse>(url, {
          signal: ctrl.signal,
          timeoutMs: 15000,
          init: { headers: { 'x-windy-api-key': WINDY_KEY } },
        });
        if (ctrl.signal.aborted) return;

        const webcams = (raw.webcams ?? []).map(w => mapWebcam(w, coords));
        cache.set(key, { data: webcams, fetchedAt: Date.now() });
        setState({ status: 'success', data: webcams, error: null });
      } catch (err: unknown) {
        if (ctrl.signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // 401 "Unauthorized domain" is treated as a plain error — UI suppresses it (section absent)
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: 'error', data: null, error: message });
      }
    })();

    return () => ctrl.abort();
  }, [coords?.lat, coords?.lon]);

  return state;
}
