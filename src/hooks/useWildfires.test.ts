import { describe, it, expect } from 'vitest';
import { isStaleDegraded, parseFirmsCsv, stateFromCached } from './useWildfires';

const CENTER = { lat: 50.2, lon: -5.48 };
const CSV = [
  'latitude,longitude,bright_ti4,acq_date,acq_time,confidence,frp',
  '50.21,-5.47,330.5,2026-07-20,512,n,4.2',    // acq_time "512" = 05:12 UTC
  '50.25,-5.40,340.1,2026-07-20,1342,h,12.0',  // acq_time "1342" = 13:42 UTC
].join('\n');

describe('parseFirmsCsv', () => {
  it('produces parseable UTC dates from colon-less acq_time', () => {
    const events = parseFirmsCsv(CSV, CENTER);
    expect(events).toHaveLength(2);
    for (const ev of events) {
      expect(Number.isFinite(new Date(ev.date).getTime())).toBe(true);
    }
    expect(new Date(events[0].date).getTime()).toBe(Date.UTC(2026, 6, 20, 5, 12, 0));
    expect(new Date(events[1].date).getTime()).toBe(Date.UTC(2026, 6, 20, 13, 42, 0));
  });

  it('pads single-digit acq_time ("5" = 00:05 UTC)', () => {
    const csv = [
      'latitude,longitude,acq_date,acq_time',
      '50.21,-5.47,2026-07-20,5',
    ].join('\n');
    const events = parseFirmsCsv(csv, CENTER);
    expect(events).toHaveLength(1);
    expect(new Date(events[0].date).getTime()).toBe(Date.UTC(2026, 6, 20, 0, 5, 0));
  });

  it('missing acq_time column still yields a finite date (midnight UTC)', () => {
    const csv = [
      'latitude,longitude,acq_date',
      '50.21,-5.47,2026-07-20',
    ].join('\n');
    const events = parseFirmsCsv(csv, CENTER);
    expect(events).toHaveLength(1);
    expect(Number.isFinite(new Date(events[0].date).getTime())).toBe(true);
    expect(new Date(events[0].date).getTime()).toBe(Date.UTC(2026, 6, 20, 0, 0, 0));
  });

  it('parses reordered headers (longitude before latitude)', () => {
    const csv = [
      'longitude,latitude,bright_ti4,acq_date,acq_time',
      '-5.47,50.21,330.5,2026-07-20,512',
    ].join('\n');
    const events = parseFirmsCsv(csv, CENTER);
    expect(events).toHaveLength(1);
    expect(events[0].lat).toBe(50.21);
    expect(events[0].lon).toBe(-5.47);
    expect(events[0].brightness).toBe(330.5);
  });
});

describe('stateFromCached', () => {
  it('preserves the degraded marker on cache hits (regression: mount 2 flipped to clean)', () => {
    const degraded = stateFromCached({ events: [], failedSources: ['FIRMS'] });
    expect(degraded.status).toBe('success');
    expect(degraded.error).toBe('FIRMS unavailable');
    expect(degraded.error).not.toBeNull();
  });

  it('full success reads clean', () => {
    const clean = stateFromCached({ events: [], failedSources: [] });
    expect(clean.status).toBe('success');
    expect(clean.error).toBeNull();
  });
});

describe('isStaleDegraded', () => {
  const NOW = 1_800_000_000_000;
  const FIVE_MIN = 5 * 60 * 1000;

  it('never retries a clean entry, however old', () => {
    expect(isStaleDegraded({ events: [], failedSources: [], at: 0 }, NOW)).toBe(false);
  });

  it('holds a fresh degraded entry rather than hammering a source that just failed', () => {
    expect(
      isStaleDegraded({ events: [], failedSources: ['FIRMS'], at: NOW - 1000 }, NOW),
    ).toBe(false);
  });

  it('retries a degraded entry once the cooldown passes', () => {
    expect(
      isStaleDegraded({ events: [], failedSources: ['FIRMS'], at: NOW - FIVE_MIN - 1 }, NOW),
    ).toBe(true);
  });

  it('retries an unstamped degraded entry', () => {
    expect(isStaleDegraded({ events: [], failedSources: ['EONET'] }, NOW)).toBe(true);
  });
});
