import { useCallback, useSyncExternalStore } from 'react';
import type { BuildingFacade, Coordinates } from '../types';

type FacadeLabel = BuildingFacade['label'];
type Slot = 'A' | 'B';

const STORAGE_KEY = 'boreas-facade-overrides-v1';

const store = new Map<string, FacadeLabel>(loadFromStorage());
const listeners = new Set<() => void>();

const FACADE_LABELS: readonly FacadeLabel[] = ['Front', 'Right', 'Rear', 'Left'];

function isEntry(v: unknown): v is [string, FacadeLabel] {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    typeof v[0] === 'string' &&
    FACADE_LABELS.includes(v[1] as FacadeLabel)
  );
}

/**
 * Runs at module scope, so anything it throws happens at import time — before
 * React mounts and outside every error boundary, i.e. a white screen. The old
 * `Array.isArray(parsed)` guard let `["a","b"]` through and `new Map` rejected
 * it. Every element is checked now; junk entries are dropped, not fatal.
 */
export function loadFromStorage(): [string, FacadeLabel][] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry);
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...store.entries()]));
  } catch { /* fail silently */ }
}

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function key(coords: Coordinates | null, slot: Slot): string | null {
  if (!coords) return null;
  return `${slot}|${coords.lat.toFixed(5)}|${coords.lon.toFixed(5)}`;
}

export function useFacadeOverride(
  coords: Coordinates | null,
  slot: Slot,
): [FacadeLabel | null, (v: FacadeLabel | null) => void] {
  const k = key(coords, slot);
  const getSnapshot = useCallback(
    () => (k ? (store.get(k) ?? null) : null),
    [k],
  );
  const value = useSyncExternalStore(subscribe, getSnapshot);
  const set = useCallback(
    (v: FacadeLabel | null) => {
      if (!k) return;
      if (v === null) {
        if (!store.has(k)) return;
        store.delete(k);
      } else {
        if (store.get(k) === v) return;
        store.set(k, v);
      }
      persist();
      emit();
    },
    [k],
  );
  return [value, set];
}
