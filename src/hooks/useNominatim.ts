import { useEffect, useRef, useState } from 'react';
import type { Coordinates } from '../types';
import { cacheGet, cacheSet, TTL } from '../utils/persistentCache';

const MIN_INTERVAL_MS = 1100;
const BASE = 'https://nominatim.openstreetmap.org';
const CONTACT = (import.meta.env.VITE_NOMINATIM_CONTACT as string | undefined) ?? '';
const CONTACT_PARAM = CONTACT ? `&email=${encodeURIComponent(CONTACT)}` : '';

let lastRequestAt = 0;
const pending: Array<() => void> = [];
let draining = false;

function drain() {
  if (draining) return;
  draining = true;
  void (async () => {
    while (pending.length > 0) {
      const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - Date.now());
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      const fn = pending.shift();
      if (fn) {
        lastRequestAt = Date.now();
        fn();
      }
    }
    draining = false;
  })();
}

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    pending.push(() => {
      fn().then(resolve, reject);
    });
    drain();
  });
}

interface NominatimAddress {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  cycleway?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  city_district?: string;
  district?: string;
  city_block?: string;
  residential?: string;
  village?: string;
  hamlet?: string;
  town?: string;
  city?: string;
  municipality?: string;
  county?: string;
  state_district?: string;
  state?: string;
  region?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
}

export interface GeocodeResult {
  coords: Coordinates;
  displayName: string;
  cleanAddress: string;
  street: string | null;
  locality: string | null;
  postcode: string | null;
  countryCode: string | null;
}

interface NominatimReverseResponse {
  display_name?: string;
  address?: NominatimAddress;
  error?: string;
}

interface NominatimSearchRow {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
}

function pickFirst<T>(...values: (T | undefined | null)[]): T | null {
  for (const v of values) {
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

function buildCleanAddress(
  address: NominatimAddress | undefined,
  displayName: string,
): string {
  if (!address) return displayName;

  const street = pickFirst(address.road, address.pedestrian, address.footway, address.cycleway);
  const neighbourhood = pickFirst(
    address.neighbourhood,
    address.suburb,
    address.quarter,
    address.district,
    address.city_district,
    address.residential,
  );
  const locality = pickFirst(
    address.city,
    address.town,
    address.village,
    address.hamlet,
    address.municipality,
  );
  const postcode = address.postcode ?? null;
  const country = address.country ?? null;

  const parts: string[] = [];

  // Street line (street + house number if present)
  if (street) {
    parts.push(address.house_number ? `${address.house_number} ${street}` : street);
    if (neighbourhood && neighbourhood !== street) parts.push(neighbourhood);
  } else if (neighbourhood) {
    parts.push(neighbourhood);
  }

  // Locality + postcode
  const postcodeLocality = [postcode, locality].filter(Boolean).join(' ');
  if (postcodeLocality) parts.push(postcodeLocality);

  // Country
  if (country && !parts.some((p) => p.toLowerCase() === country.toLowerCase())) {
    parts.push(country);
  }

  // Dedupe case-insensitive substring
  const deduped: string[] = [];
  for (const p of parts) {
    const lower = p.toLowerCase();
    const redundant = deduped.some((d) => {
      const dl = d.toLowerCase();
      return dl === lower || dl.includes(lower);
    });
    if (!redundant) deduped.push(p);
  }

  return deduped.join(', ') || displayName;
}

function mapResult(
  coords: Coordinates,
  displayName: string,
  address: NominatimAddress | undefined,
): GeocodeResult {
  const street = pickFirst(address?.road, address?.pedestrian, address?.footway);
  const houseStreet = street
    ? address?.house_number
      ? `${address.house_number} ${street}`
      : street
    : null;

  return {
    coords,
    displayName,
    cleanAddress: buildCleanAddress(address, displayName),
    street: houseStreet,
    locality: pickFirst(address?.city, address?.town, address?.village, address?.municipality),
    postcode: address?.postcode ?? null,
    countryCode: address?.country_code?.toUpperCase() ?? null,
  };
}

const reverseMemoryCache = new Map<string, GeocodeResult>();

function makeReverseKey(coords: Coordinates): string {
  return `nominatim:reverse:${coords.lat.toFixed(5)}|${coords.lon.toFixed(5)}`;
}

export async function reverseGeocode(
  coords: Coordinates,
  signal?: AbortSignal,
): Promise<GeocodeResult> {
  const key = makeReverseKey(coords);

  const mem = reverseMemoryCache.get(key);
  if (mem) return mem;

  const persistent = await cacheGet<GeocodeResult>(key);
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
  if (persistent) {
    reverseMemoryCache.set(key, persistent);
    return persistent;
  }

  return throttled(async () => {
    const url =
      `${BASE}/reverse?lat=${coords.lat}&lon=${coords.lon}` +
      `&format=json&zoom=18&addressdetails=1${CONTACT_PARAM}`;
    const res = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Nominatim reverse failed: HTTP ${res.status}`);
    }
    const data = (await res.json()) as NominatimReverseResponse;
    if (data.error) throw new Error(`Nominatim: ${data.error}`);
    const result = mapResult(coords, data.display_name ?? '', data.address);
    reverseMemoryCache.set(key, result);
    void cacheSet(key, result, TTL.nominatim);
    return result;
  });
}

export async function forwardGeocode(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodeResult[]> {
  return throttled(async () => {
    const url =
      `${BASE}/search?q=${encodeURIComponent(query)}` +
      `&format=json&limit=6&addressdetails=1${CONTACT_PARAM}`;
    const res = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Nominatim search failed: HTTP ${res.status}`);
    }
    const rows = (await res.json()) as NominatimSearchRow[];
    return rows.map((row) =>
      mapResult(
        { lat: parseFloat(row.lat), lon: parseFloat(row.lon) },
        row.display_name,
        row.address,
      ),
    );
  });
}

export function useReverseGeocode(coords: Coordinates | null) {
  const [result, setResult] = useState<GeocodeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!coords) {
      setResult(null);
      setError(null);
      setLoading(false);
      return;
    }
    controllerRef.current?.abort();
    const ctrl = new AbortController();
    controllerRef.current = ctrl;
    setLoading(true);
    setError(null);
    reverseGeocode(coords, ctrl.signal)
      .then((r) => {
        if (ctrl.signal.aborted) return;
        setResult(r);
        setLoading(false);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [coords?.lat, coords?.lon]);

  return { result, loading, error };
}
