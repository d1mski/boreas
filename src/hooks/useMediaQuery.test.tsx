// @vitest-environment jsdom
//
// useMediaQuery decides which of the two sheets mounts (App.tsx:174/178). Before
// the audit fix both mounted and one was CSS-hidden, so every data hook and
// chart ran twice on every viewport. The guard is only as good as this hook, and
// jsdom has no matchMedia, so it gets a controllable stub.
import { render, screen, act, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMediaQuery } from './useMediaQuery';

type Listener = (e: MediaQueryListEvent) => void;

/** Minimal matchMedia whose match state can be flipped mid-test. */
function stubMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  let matches = initial;
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      media: query,
      get matches() {
        return matches;
      },
      addEventListener: (_: string, l: Listener) => listeners.add(l),
      removeEventListener: (_: string, l: Listener) => listeners.delete(l),
      // Legacy API — unused by the hook, present so the shape is honest.
      addListener: (l: Listener) => listeners.add(l),
      removeListener: (l: Listener) => listeners.delete(l),
      dispatchEvent: () => false,
      onchange: null,
    })),
  );
  return {
    set(next: boolean) {
      matches = next;
      for (const l of listeners) l({ matches: next } as MediaQueryListEvent);
    },
    listenerCount: () => listeners.size,
  };
}

// Stand-in for App's two-sheet decision.
function Sheets() {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  return (
    <>
      {isDesktop && <div data-testid="desktop-sheet" />}
      {!isDesktop && <div data-testid="mobile-sheet" />}
    </>
  );
}

// Auto-cleanup only fires with vitest `globals: true`, which this repo does not
// set — without it, mounted trees leak into the next test's queries.
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useMediaQuery', () => {
  it('reads the initial match state on first render', () => {
    stubMatchMedia(true);
    render(<Sheets />);
    expect(screen.getByTestId('desktop-sheet')).toBeDefined();
    expect(screen.queryByTestId('mobile-sheet')).toBeNull();
  });

  it('mounts exactly one sheet on mobile', () => {
    stubMatchMedia(false);
    render(<Sheets />);
    expect(screen.getByTestId('mobile-sheet')).toBeDefined();
    expect(screen.queryByTestId('desktop-sheet')).toBeNull();
  });

  it('swaps sheets when the viewport crosses the breakpoint', () => {
    const mm = stubMatchMedia(true);
    render(<Sheets />);
    expect(screen.queryByTestId('desktop-sheet')).not.toBeNull();

    act(() => mm.set(false));

    // Still exactly one — never both, which was the double-fetch bug.
    expect(screen.queryByTestId('desktop-sheet')).toBeNull();
    expect(screen.queryByTestId('mobile-sheet')).not.toBeNull();
  });

  it('removes its listener on unmount', () => {
    const mm = stubMatchMedia(true);
    const view = render(<Sheets />);
    expect(mm.listenerCount()).toBe(1);
    view.unmount();
    expect(mm.listenerCount()).toBe(0);
  });
});
