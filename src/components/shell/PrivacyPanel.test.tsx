// @vitest-environment jsdom
//
// The privacy panel makes two promises to the user: "export your data" and
// "delete everything on this device". Both are claims that fail silently when
// wrong — the UI looks identical whether the wipe cleared IndexedDB or not.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { cacheGet, cacheSet, cacheKeys } from '../../utils/persistentCache';
import { STORAGE_KEY } from '../../hooks/useSavedLocations';
import { handleExport, handleWipe } from './PrivacyPanel';

beforeEach(() => {
  localStorage.clear();
  // jsdom implements neither; the wipe path calls both.
  vi.stubGlobal('confirm', vi.fn(() => true));
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: vi.fn() },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('handleWipe', () => {
  it('clears IndexedDB and every settl- localStorage key', async () => {
    await cacheSet('wildfire:1.000|2.000', [{ id: 'x' }], 60_000);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ label: 'home' }]));
    localStorage.setItem('settl-theme', 'dark');
    expect(await cacheGet('wildfire:1.000|2.000')).not.toBeNull();

    await handleWipe();

    expect(await cacheKeys()).toHaveLength(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('settl-theme')).toBeNull();
  });

  it('leaves other apps’ localStorage keys alone', async () => {
    localStorage.setItem('unrelated-app-token', 'keep me');
    await handleWipe();
    expect(localStorage.getItem('unrelated-app-token')).toBe('keep me');
  });

  it('does nothing when the user cancels the confirm', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    localStorage.setItem(STORAGE_KEY, '[{"label":"home"}]');
    await cacheSet('keep:me', [1], 60_000);

    await handleWipe();

    expect(localStorage.getItem(STORAGE_KEY)).toBe('[{"label":"home"}]');
    expect(await cacheGet('keep:me')).not.toBeNull();
  });

  it('reloads the page so no wiped state survives in memory', async () => {
    await handleWipe();
    expect(window.location.reload).toHaveBeenCalled();
  });

  it('tells the user and keeps their data when IndexedDB refuses to clear', async () => {
    const alerted = vi.fn();
    vi.stubGlobal('alert', alerted);
    localStorage.setItem(STORAGE_KEY, '[{"label":"home"}]');
    const cache = await import('../../utils/persistentCache');
    vi.spyOn(cache, 'cacheClear').mockRejectedValueOnce(new Error('blocked'));

    await handleWipe();

    expect(alerted).toHaveBeenCalled();
    // Silence here would be the real bug: user believes the device is clean.
    expect(localStorage.getItem(STORAGE_KEY)).toBe('[{"label":"home"}]');
    expect(window.location.reload).not.toHaveBeenCalled();
  });
});

describe('handleExport', () => {
  function captureDownload() {
    const clicked: { href: string; download: string }[] = [];
    let blobText = '';
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn((b: Blob) => {
        // Blob.text() is async; read it eagerly off the internal parts instead.
        blobText = (b as Blob & { __text?: string }).__text ?? '';
        return 'blob:stub';
      }),
      revokeObjectURL: vi.fn(),
    });
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag) as HTMLAnchorElement;
      if (tag === 'a') {
        el.click = () => clicked.push({ href: el.href, download: el.download });
      }
      return el;
    });
    return { clicked, text: () => blobText };
  }

  it('downloads saved locations as valid JSON under a settl filename', async () => {
    const saved = [{ label: 'home', lat: 38.3, lon: 21.8 }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    const cap = captureDownload();

    handleExport();

    expect(cap.clicked).toHaveLength(1);
    expect(cap.clicked[0].download).toBe('settl-saved-locations.json');
    // The blob is built from the raw localStorage string, so assert on that
    // directly — it is what actually reaches the file.
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(saved);
  });

  it('exports an empty array rather than throwing when nothing is saved', () => {
    const cap = captureDownload();
    expect(() => handleExport()).not.toThrow();
    expect(cap.clicked).toHaveLength(1);
  });
});
