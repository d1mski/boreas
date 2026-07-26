// @vitest-environment jsdom
//
// loadFromStorage runs at module scope, so a throw here is an import-time
// crash: no React, no error boundary, white screen. Anything localStorage can
// hold must come back as a valid entry list or an empty one — never an
// exception, and never a shape `new Map` will reject.
import { beforeEach, describe, expect, it } from 'vitest';
import { loadFromStorage } from './useFacadeOverride';

const STORAGE_KEY = 'settl-facade-overrides-v1';

beforeEach(() => {
  localStorage.clear();
});

describe('loadFromStorage', () => {
  it('round-trips valid entries', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([['A|51.5|0.1', 'Front']]));
    expect(loadFromStorage()).toEqual([['A|51.5|0.1', 'Front']]);
  });

  it('returns empty when nothing is stored', () => {
    expect(loadFromStorage()).toEqual([]);
  });

  it.each([
    ['["a","b"]', 'flat string array — the white-screen case'],
    ['[1,2]', 'flat number array'],
    ['[[1,"Front"]]', 'non-string key'],
    ['[["k","Roof"]]', 'label outside the union'],
    ['[["k"]]', 'short tuple'],
    ['[["k","Front","extra"]]', 'long tuple'],
    ['[null]', 'null element'],
    ['{"not":"an array"}', 'object'],
    ['"a string"', 'bare string'],
    ['not json at all', 'unparseable'],
  ])('survives %s (%s)', (raw) => {
    localStorage.setItem(STORAGE_KEY, raw);
    const out = loadFromStorage();
    expect(Array.isArray(out)).toBe(true);
    // The real assertion: whatever comes back must be Map-constructible,
    // because that is what happens at import time.
    expect(() => new Map(out)).not.toThrow();
  });

  it('keeps the good entries and drops the junk in a mixed list', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([['ok', 'Rear'], 'junk', ['bad', 'Roof'], ['ok2', 'Left']]),
    );
    expect(loadFromStorage()).toEqual([
      ['ok', 'Rear'],
      ['ok2', 'Left'],
    ]);
  });
});
