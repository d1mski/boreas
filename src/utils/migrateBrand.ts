// One-time migration for the settl. → Boreas rename (2026-07-25).
//
// Storage keys were prefixed `settl-`. Renaming them without moving the data
// would silently drop every existing user's saved locations, theme and font
// scale — invisible at deploy time, discovered by the user as "my pins are
// gone". This copies each legacy key to its `boreas-` name and removes the old
// one, so it is a no-op from the second load onwards.
//
// MUST run before anything reads storage. useFacadeOverride builds its Map at
// module scope, so main.tsx imports this first — ES modules evaluate in import
// order, which puts this ahead of App's whole dependency tree.

const LEGACY_PREFIX = 'settl-';
const PREFIX = 'boreas-';
const LEGACY_CACHE_DB = 'settl-cache';

/** Exported for test; call `migrateBrandStorage()` in app code. */
export function migrateLocalStorage(storage: Storage): string[] {
  const moved: string[] = [];
  // Snapshot the keys — removeItem during a live key() walk reindexes.
  const legacy = Object.keys(storage).filter((k) => k.startsWith(LEGACY_PREFIX));
  for (const key of legacy) {
    const next = PREFIX + key.slice(LEGACY_PREFIX.length);
    const value = storage.getItem(key);
    // A value already under the new name wins: it is necessarily newer, and
    // overwriting it would undo whatever the user did after migrating.
    if (value !== null && storage.getItem(next) === null) {
      storage.setItem(next, value);
      moved.push(next);
    }
    storage.removeItem(key);
  }
  return moved;
}

export function migrateBrandStorage(): void {
  try {
    migrateLocalStorage(localStorage);
  } catch {
    // Private mode / disabled storage. Nothing to migrate and nothing to fix.
  }
  try {
    // The IDB cache is disposable — everything in it re-fetches. Dropping the
    // old database avoids leaving an orphan holding quota forever.
    indexedDB.deleteDatabase(LEGACY_CACHE_DB);
  } catch {
    // Not fatal: worst case the old database lingers unused.
  }
}

// Module-scope side effect. main.tsx imports this file for exactly this: it has
// to run while modules are still being evaluated, before App's imports read
// storage. Tests import migrateLocalStorage above, which does not self-run.
migrateBrandStorage();
