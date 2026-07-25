// Shared in-flight fetch with subscriber refcounting.
//
// Problem it replaces (audit HIGH): hooks either duplicated concurrent
// fetches (no in-flight map) or leaked abandoned AbortControllers that held
// semaphore slots for minutes. Here, concurrent subscribers to the same key
// share one factory run; the underlying fetch is aborted only when the LAST
// subscriber releases (unmount / coord change).
//
// Usage in a hook effect:
//   const sub = sharedFetch(inflight, key, (signal) => fetchThing(coords, signal));
//   sub.promise.then(...).catch(...);
//   return () => sub.release();

export interface SharedEntry<T> {
  promise: Promise<T>;
  ctrl: AbortController;
  subs: number;
  settled: boolean;
}

export function createSharedMap<T>(): Map<string, SharedEntry<T>> {
  return new Map();
}

export interface SharedSubscription<T> {
  promise: Promise<T>;
  release: () => void;
}

export function sharedFetch<T>(
  map: Map<string, SharedEntry<T>>,
  key: string,
  factory: (signal: AbortSignal) => Promise<T>,
): SharedSubscription<T> {
  let entry = map.get(key);
  // `settled` is normally unreachable here — the finally below deletes the
  // entry — but a subscriber arriving in the microtask gap would otherwise
  // adopt a finished promise, inheriting a stale rejection it cannot retry.
  if (!entry || entry.ctrl.signal.aborted || entry.settled) {
    const ctrl = new AbortController();
    const fresh: SharedEntry<T> = { ctrl, subs: 0, settled: false, promise: undefined as unknown as Promise<T> };
    fresh.promise = factory(ctrl.signal).finally(() => {
      fresh.settled = true;
      if (map.get(key) === fresh) map.delete(key);
    });
    // Swallow rejection at the entry level so an aborted shared fetch with no
    // remaining subscribers never surfaces as an unhandled rejection.
    fresh.promise.catch(() => {});
    map.set(key, fresh);
    entry = fresh;
  }
  entry.subs += 1;
  const captured = entry;
  let released = false;
  return {
    promise: captured.promise,
    release: () => {
      if (released) return;
      released = true;
      captured.subs -= 1;
      if (captured.subs <= 0 && !captured.settled) {
        captured.ctrl.abort();
        if (map.get(key) === captured) map.delete(key);
      }
    },
  };
}

export type SharedMap<T> = Map<string, SharedEntry<T>>;
