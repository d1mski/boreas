import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { cacheGet, cacheSet } from './persistentCache';

describe('persistentCache contract', () => {
  it('returns value inside TTL', async () => {
    await cacheSet('t:inside', { a: 1 }, 60_000);
    expect(await cacheGet<{ a: number }>('t:inside')).toEqual({ a: 1 });
  });
  it('returns null past TTL', async () => {
    await cacheSet('t:expired', 'v', -1); // already expired
    expect(await cacheGet('t:expired')).toBeNull();
  });
  it('rejects entries from an older schema version', async () => {
    // Write a raw entry with a stale version through the same idb store.
    const { createStore, set } = await import('idb-keyval');
    const store = createStore('settl-cache', 'kv');
    await set('t:oldver', { data: 'v', fetchedAt: Date.now(), ttl: 60_000, version: -1 }, store);
    expect(await cacheGet('t:oldver')).toBeNull();
  });
});
