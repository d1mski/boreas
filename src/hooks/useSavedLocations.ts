import { useState, useCallback } from 'react';
import type { SavedLocation } from '../types';

export type { SavedLocation } from '../types';

export const STORAGE_KEY = 'settl-saved-locations-v1';
const MAX_ITEMS = 10;

// Exported for its unit test (localStorage parsing has to reject malformed
// entries); the app itself should go through useSavedLocations.
export function load(): SavedLocation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is SavedLocation =>
        typeof l === 'object' && l !== null &&
        typeof (l as SavedLocation).id === 'string' &&
        typeof (l as SavedLocation).label === 'string' &&
        Number.isFinite((l as SavedLocation).lat) &&
        Number.isFinite((l as SavedLocation).lon),
    );
  } catch {
    return [];
  }
}

function persist(items: SavedLocation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Fail silently — handles QuotaExceededError in incognito
  }
}

export function useSavedLocations() {
  const [locations, setLocations] = useState<SavedLocation[]>(() => load());

  const isSaved = useCallback(
    (lat: number, lon: number): boolean => {
      const id = `${lat.toFixed(5)},${lon.toFixed(5)}`;
      return locations.some(l => l.id === id);
    },
    [locations],
  );

  const toggle = useCallback(
    (entry: { label: string; lat: number; lon: number }): { rejected: boolean } => {
      const id = `${entry.lat.toFixed(5)},${entry.lon.toFixed(5)}`;
      const alreadySaved = locations.some(l => l.id === id);

      if (alreadySaved) {
        setLocations(prev => {
          const next = prev.filter(l => l.id !== id);
          persist(next);
          return next;
        });
        return { rejected: false };
      }

      if (locations.length >= MAX_ITEMS) {
        return { rejected: true };
      }

      setLocations(prev => {
        const next = [...prev, { ...entry, id, savedAt: Date.now() }];
        persist(next);
        return next;
      });
      return { rejected: false };
    },
    [locations],
  );

  const remove = useCallback((id: string): void => {
    setLocations(prev => {
      const next = prev.filter(l => l.id !== id);
      persist(next);
      return next;
    });
  }, []);

  return { locations, isSaved, toggle, remove };
}
