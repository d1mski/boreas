import { describe, it, expect, beforeEach } from 'vitest';
import { load } from './useSavedLocations';

const STORAGE_KEY = 'settl-saved-locations-v1';

// Test runs under vitest's 'node' environment (see vite.config.ts) — no DOM,
// so localStorage isn't ambient. `load()` only calls getItem, so a minimal
// in-memory stub is enough; no jsdom dependency needed.
function makeLocalStorageStub(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => void data.clear(),
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    get length() {
      return data.size;
    },
  };
}

globalThis.localStorage = makeLocalStorageStub();

describe('useSavedLocations load validation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty array when nothing is stored', () => {
    expect(load()).toEqual([]);
  });

  it('returns empty array for malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(load()).toEqual([]);
  });

  it('returns empty array when stored value is not an array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: 'a' }));
    expect(load()).toEqual([]);
  });

  it('filters out records missing required fields or with wrong types', () => {
    const valid = { id: '1,1', label: 'Home', lat: 1, lon: 1, savedAt: 1 };
    const badLat = { id: '2,2', label: 'Bad', lat: 'x', lon: 2, savedAt: 1 };
    const badLon = { id: '3,3', label: 'Bad', lat: 3, lon: NaN, savedAt: 1 };
    const noLabel = { id: '4,4', lat: 4, lon: 4, savedAt: 1 };
    const noId = { label: 'No id', lat: 5, lon: 5, savedAt: 1 };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([valid, badLat, badLon, noLabel, noId, null, 'string', 42]),
    );
    expect(load()).toEqual([valid]);
  });
});
