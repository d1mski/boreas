import { createStore, get, set, del, keys, clear } from 'idb-keyval';

const store = createStore('settl-cache', 'kv');

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  ttl: number;
  version: number;
}

// Bump to invalidate all cached entries when the schema / parsing changes.
const SCHEMA_VERSION = 2;

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const entry = await get<CacheEntry<T>>(key, store);
    if (!entry) return null;
    if (entry.version !== SCHEMA_VERSION) {
      void del(key, store);
      return null;
    }
    if (Date.now() - entry.fetchedAt > entry.ttl) {
      void del(key, store);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, data: T, ttlMs: number): Promise<void> {
  try {
    const entry: CacheEntry<T> = {
      data,
      fetchedAt: Date.now(),
      ttl: ttlMs,
      version: SCHEMA_VERSION,
    };
    await set(key, entry, store);
  } catch {
    // IDB can fail (private mode, quota, etc.) — swallow.
  }
}

export async function cacheClear(): Promise<void> {
  try {
    await clear(store);
  } catch {
    // swallow
  }
}

export async function cacheKeys(): Promise<IDBValidKey[]> {
  try {
    return await keys(store);
  } catch {
    return [];
  }
}

export const TTL = {
  openMeteoArchive: 30 * 24 * 60 * 60 * 1000,
  openMeteoAirQuality: 12 * 60 * 60 * 1000,
  earthquakes: 6 * 60 * 60 * 1000,
  overpassBuilding: 30 * 24 * 60 * 60 * 1000,
  overpassFeatures: 30 * 24 * 60 * 60 * 1000,
  elevation: 365 * 24 * 60 * 60 * 1000,
  wikipedia: 14 * 24 * 60 * 60 * 1000,
  nominatim: 30 * 24 * 60 * 60 * 1000,
  openMeteoFlood: 6 * 60 * 60 * 1000,  // 6 hours — GloFAS reanalysis updates daily
  marineConditions: 15 * 60 * 1000,  // 15 min — Marine model updates ~15-min interval
} as const;
