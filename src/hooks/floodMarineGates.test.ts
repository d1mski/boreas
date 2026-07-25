import { describe, it, expect } from 'vitest';
import { isNotApplicable } from './useFlood';
import { wmoSeverity } from './useMarine';

describe('flood not-applicable gate', () => {
  it('all zeros (desert) and all nulls (ocean) are not-applicable', () => {
    expect(isNotApplicable([0, 0, 0])).toBe(true);
    expect(isNotApplicable([null, null])).toBe(true);
    expect(isNotApplicable([0, null, 0])).toBe(true);
  });
  it('any real discharge means applicable', () => {
    expect(isNotApplicable([0, null, 3.2])).toBe(false);
  });
});

// Real band edges pinned from useMarine.ts wmoSeverity source:
//   null        -> 'unavailable'
//   < 2.5        -> 'ok'
//   2.5 to 4.0   -> 'watch'   (<= 4.0)
//   > 4.0        -> 'alert'
describe('WMO sea-state severity bands', () => {
  it('null wave height is unavailable (inland/no data)', () => {
    expect(wmoSeverity(null)).toBe('unavailable');
  });
  it('below 2.5m is ok', () => {
    expect(wmoSeverity(0.1)).toBe('ok');
    expect(wmoSeverity(2.49)).toBe('ok');
  });
  it('ok/watch edge sits at 2.5 inclusive', () => {
    expect(wmoSeverity(2.5)).toBe('watch');
  });
  it('watch/alert edge sits at 4.0 inclusive', () => {
    expect(wmoSeverity(4.0)).toBe('watch');
    expect(wmoSeverity(4.01)).toBe('alert');
  });
  it('above 4.0 is alert', () => {
    expect(wmoSeverity(10)).toBe('alert');
  });
});
