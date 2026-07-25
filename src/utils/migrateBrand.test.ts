// @vitest-environment jsdom
//
// The rename moved every storage key from `settl-` to `boreas-`. Getting this
// wrong loses a user's saved locations with no error and no way to tell — the
// app just comes up empty. Exercised against a fake Storage so the assertions
// are about the algorithm, not about jsdom's globals.
import { beforeEach, describe, expect, it } from 'vitest';
import { migrateLocalStorage } from './migrateBrand';

/** Minimal Storage: only what the migration touches, plus Object.keys support. */
function fakeStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  const s = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  // Object.keys(storage) is how the migration enumerates; mirror real Storage
  // by exposing each key as an own enumerable property.
  return new Proxy(s as unknown as Storage, {
    ownKeys: () => [...map.keys()],
    getOwnPropertyDescriptor: (_t, p) =>
      map.has(p as string)
        ? { enumerable: true, configurable: true, value: map.get(p as string) }
        : undefined,
  });
}

let store: Storage;

beforeEach(() => {
  store = fakeStorage();
});

describe('migrateLocalStorage', () => {
  it('moves saved locations to the new prefix', () => {
    const saved = '[{"id":"1","label":"home","lat":51.5,"lon":-0.1}]';
    store = fakeStorage({ 'settl-saved-locations-v1': saved });

    migrateLocalStorage(store);

    expect(store.getItem('boreas-saved-locations-v1')).toBe(saved);
    expect(store.getItem('settl-saved-locations-v1')).toBeNull();
  });

  it('moves every legacy key, not just the first', () => {
    store = fakeStorage({
      'settl-theme': 'dark',
      'settl-font-scale': '1.2',
      'settl-facade-overrides-v1': '[["a","Front"]]',
      'settl-saved-locations-v1': '[]',
    });

    const moved = migrateLocalStorage(store);

    expect(moved).toHaveLength(4);
    expect(store.getItem('boreas-theme')).toBe('dark');
    expect(store.getItem('boreas-font-scale')).toBe('1.2');
    expect(store.getItem('boreas-facade-overrides-v1')).toBe('[["a","Front"]]');
    expect(Object.keys(store).filter((k) => k.startsWith('settl-'))).toEqual([]);
  });

  it('never clobbers a value already stored under the new name', () => {
    store = fakeStorage({ 'settl-theme': 'dark', 'boreas-theme': 'light' });

    migrateLocalStorage(store);

    // The boreas- value is necessarily the newer one.
    expect(store.getItem('boreas-theme')).toBe('light');
    expect(store.getItem('settl-theme')).toBeNull();
  });

  it('leaves unrelated keys alone', () => {
    store = fakeStorage({ 'settl-theme': 'dark', 'other-app': 'keep' });

    migrateLocalStorage(store);

    expect(store.getItem('other-app')).toBe('keep');
  });

  it('is a no-op on a second run', () => {
    store = fakeStorage({ 'settl-theme': 'dark' });

    migrateLocalStorage(store);
    const second = migrateLocalStorage(store);

    expect(second).toEqual([]);
    expect(store.getItem('boreas-theme')).toBe('dark');
  });

  it('does nothing when there is nothing to migrate', () => {
    expect(migrateLocalStorage(fakeStorage())).toEqual([]);
  });
});
