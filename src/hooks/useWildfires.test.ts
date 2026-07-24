import { describe, it, expect } from 'vitest';
import { parseFirmsCsv } from './useWildfires';

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
});
