import { describe, it, expect } from 'vitest';
import { deriveAirSeverity } from './overviewSeverity';
import type { ModuleState, AqiSample } from '../types';

const sample = (pm25: number | null): AqiSample => ({
  time: '2026-07-01T00:00', europeanAqi: null, pm10: null, pm25,
  no2: null, o3: null, alderPollen: null, birchPollen: null, grassPollen: null,
  mugwortPollen: null, olivePollen: null, ragweedPollen: null,
});
const ok = (data: AqiSample[]): ModuleState<AqiSample[]> => ({ status: 'success', data, error: null });

describe('deriveAirSeverity null handling', () => {
  it('ignores null hours instead of treating them as pristine air', () => {
    // mean of [6, 6] = 6 -> watch; the old ??0 coercion gave mean 3 -> ok
    const r = deriveAirSeverity(ok([sample(6), sample(null), sample(6), sample(null)]));
    expect(r.severity).toBe('watch');
  });
  it('all-null coverage = unavailable, not ok', () => {
    const r = deriveAirSeverity(ok([sample(null), sample(null)]));
    expect(r.severity).toBe('unavailable');
  });
});
