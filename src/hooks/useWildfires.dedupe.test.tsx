// @vitest-environment jsdom
//
// Mount-level tests for the sharedFetch scaffold, using useWildfires as the
// representative hook — it has the most call sites (RiskPanel, HazardsModule,
// HazardsMapLayer, ReportPanel all mount it with the same coords). Every other
// data hook copies this same memory-Map → cacheGet → sharedFetch → cacheSet
// shape, so a break here is a break everywhere.
//
// These cover what the pure-function tests can't: that the hook actually wires
// sharedFetch up right on mount, unmount, and coord change. Manual QA can't
// read this reliably in dev because StrictMode double-invokes every effect.
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// IDB is irrelevant here and would just add async noise — always miss.
vi.mock('../utils/persistentCache', () => ({
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => {}),
  TTL: {},
}));

import { useWildfires } from './useWildfires';

interface Call {
  url: string;
  signal: AbortSignal | undefined;
}

let calls: Call[] = [];

/** Resolves EONET/FIRMS with empty-but-valid payloads. */
function respondEmpty() {
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ events: [] }),
    text: async () => '',
  } as unknown as Response);
}

/** Never resolves; rejects only when the caller aborts. */
function respondPending(signal: AbortSignal | undefined) {
  return new Promise<Response>((_resolve, reject) => {
    signal?.addEventListener(
      'abort',
      () => reject(new DOMException('aborted', 'AbortError')),
      { once: true },
    );
  });
}

function installFetch(mode: 'empty' | 'pending') {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, signal: init?.signal ?? undefined });
      return mode === 'empty' ? respondEmpty() : respondPending(init?.signal ?? undefined);
    }),
  );
}

const eonetCalls = () => calls.filter((c) => c.url.includes('eonet.gsfc.nasa.gov'));

function Probe({ lat, lon }: { lat: number; lon: number }) {
  useWildfires({ lat, lon });
  return null;
}

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// Each test uses distinct coords — the hook's module-level memory cache is not
// resettable from outside, and a shared pin would make later tests cache-hit.
describe('useWildfires sharedFetch wiring', () => {
  it('fetches once when three components mount the same coords', async () => {
    installFetch('empty');
    const coords = { lat: 10.111, lon: 20.111 };

    render(
      <>
        <Probe {...coords} />
        <Probe {...coords} />
        <Probe {...coords} />
      </>,
    );

    await waitFor(() => expect(eonetCalls().length).toBeGreaterThan(0));
    // Give any duplicate effect a chance to fire before asserting the count.
    await new Promise((r) => setTimeout(r, 20));
    expect(eonetCalls()).toHaveLength(1);
  });

  it('aborts the in-flight request when the last subscriber unmounts', async () => {
    installFetch('pending');
    const coords = { lat: 11.222, lon: 21.222 };

    const view = render(
      <>
        <Probe {...coords} />
        <Probe {...coords} />
      </>,
    );
    await waitFor(() => expect(eonetCalls().length).toBe(1));
    const signal = eonetCalls()[0].signal;
    expect(signal?.aborted).toBe(false);

    view.unmount();
    await waitFor(() => expect(signal?.aborted).toBe(true));
  });

  it('keeps the request alive while any subscriber remains', async () => {
    installFetch('pending');
    const coords = { lat: 12.333, lon: 22.333 };

    function Pair({ showSecond }: { showSecond: boolean }) {
      return (
        <>
          <Probe {...coords} />
          {showSecond && <Probe {...coords} />}
        </>
      );
    }

    const view = render(<Pair showSecond />);
    await waitFor(() => expect(eonetCalls().length).toBe(1));
    const signal = eonetCalls()[0].signal;

    view.rerender(<Pair showSecond={false} />);
    await new Promise((r) => setTimeout(r, 20));
    // One subscriber left — the refcount must not have hit zero.
    expect(signal?.aborted).toBe(false);
  });

  it('aborts the old request and starts a new one when coords change', async () => {
    installFetch('pending');
    const first = { lat: 13.444, lon: 23.444 };
    const second = { lat: 14.555, lon: 24.555 };

    const view = render(<Probe {...first} />);
    await waitFor(() => expect(eonetCalls().length).toBe(1));
    const firstSignal = eonetCalls()[0].signal;

    view.rerender(<Probe {...second} />);
    await waitFor(() => expect(eonetCalls().length).toBe(2));
    // Stale request must be torn down, else its response can land in the panel
    // after the new location's — the silent wrong-data bug.
    await waitFor(() => expect(firstSignal?.aborted).toBe(true));
    expect(eonetCalls()[1].signal?.aborted).toBe(false);
  });
});
