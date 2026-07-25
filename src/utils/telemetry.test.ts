// @vitest-environment jsdom
//
// The app writes the pinned location into the URL (`?lat=…&lon=…`, useUrlState)
// and Umami's tracker patches history, so without data-exclude-search every pin
// drop ships the exact queried coordinates to the analytics host as a pageview
// URL. That failure is completely silent — the app works, the dashboard fills
// up, and the coordinates are simply gone.
import { describe, expect, it } from 'vitest';
import { createUmamiScript } from './telemetry';

describe('createUmamiScript', () => {
  it('strips the query string, which carries the pinned coordinates', () => {
    const s = createUmamiScript('https://cloud.umami.is/script.js', 'abc-123');
    // Umami reads this as data-exclude-search.
    expect(s.dataset.excludeSearch).toBe('true');
    expect(s.getAttribute('data-exclude-search')).toBe('true');
  });

  it('carries the website id and src it was given, and defers', () => {
    const s = createUmamiScript('https://example.com/u.js', 'site-42');
    expect(s.dataset.websiteId).toBe('site-42');
    expect(s.src).toBe('https://example.com/u.js');
    expect(s.defer).toBe(true);
  });

  it('puts no coordinates in the tag itself', () => {
    const s = createUmamiScript('https://example.com/u.js?lat=1&lon=2', 'id');
    // The src is operator-configured, but the attributes we add must never
    // interpolate app state.
    expect(s.outerHTML).not.toMatch(/data-[a-z-]*=["'][^"']*\blat\b/);
  });
});
