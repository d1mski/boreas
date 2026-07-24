import { describe, it, expect } from 'vitest';
import { sharedFetch, createSharedMap } from './sharedFetch';

describe('sharedFetch', () => {
  it('dedupes concurrent callers onto one factory run', async () => {
    const map = createSharedMap<string>();
    let runs = 0;
    const factory = async () => { runs += 1; return 'data'; };
    const a = sharedFetch(map, 'k', factory);
    const b = sharedFetch(map, 'k', factory);
    expect(await a.promise).toBe('data');
    expect(await b.promise).toBe('data');
    expect(runs).toBe(1);
  });

  it('aborts the underlying fetch only when the last subscriber releases', async () => {
    const map = createSharedMap<string>();
    let signal: AbortSignal | undefined;
    const factory = (s: AbortSignal) =>
      new Promise<string>((resolve, reject) => {
        signal = s;
        s.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        setTimeout(() => resolve('late'), 50);
      });
    const a = sharedFetch(map, 'k', factory);
    const b = sharedFetch(map, 'k', factory);
    a.release();
    expect(signal!.aborted).toBe(false);   // b still subscribed
    b.release();
    expect(signal!.aborted).toBe(true);    // last one out aborts
    await expect(a.promise).rejects.toThrow();
  });

  it('a new subscriber after full abort gets a fresh run', async () => {
    const map = createSharedMap<string>();
    let runs = 0;
    const factory = (s: AbortSignal) => {
      runs += 1;
      return new Promise<string>((resolve, reject) => {
        s.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        setTimeout(() => resolve('ok'), 10);
      });
    };
    const first = sharedFetch(map, 'k', factory);
    first.release(); // aborts immediately (sole subscriber)
    await first.promise.catch(() => {});
    const second = sharedFetch(map, 'k', factory);
    expect(await second.promise).toBe('ok');
    expect(runs).toBe(2);
  });

  it('completed fetch releases without side effects', async () => {
    const map = createSharedMap<string>();
    const a = sharedFetch(map, 'k', async () => 'v');
    expect(await a.promise).toBe('v');
    a.release(); // no-op after settle — must not throw
    expect(map.size).toBe(0);
  });
});
