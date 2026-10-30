import { describe, expect, it } from 'vitest';
import { parseDrafts, worthKeeping, type Draft } from './drafts';

const draft: Draft = {
  bars: [{ x: 120, y: 300, deg: 30 }, null], angle: 41.3, power: 62.5, tries: 3, helped: false,
  launches: [{ pieces: [{ x: 120, y: 300, deg: 30, len: 90 }], angle: 40, power: 60 }],
};

describe('drafts', () => {
  it('read back what was saved', () => {
    expect(parseDrafts(JSON.stringify({ '01-first-bounce': draft }))).toEqual({ '01-first-bounce': draft });
  });

  it('drop anything malformed', () => {
    expect(parseDrafts('not json')).toEqual({});
    expect(parseDrafts(JSON.stringify({ a: { bars: [{ x: 1 }], angle: 1, power: 1 }, b: { bars: [], angle: 'x', power: 1 } }))).toEqual({});
    const odd = parseDrafts(JSON.stringify({ a: { bars: [null], angle: 1, power: 2, launches: [{ angle: 1 }] } }));
    expect(odd.a).toEqual({ bars: [null], angle: 1, power: 2, tries: 0, helped: false, launches: [] });
  });

  it('only keep a level that was touched', () => {
    const fresh = { angle: 52, power: 45 };
    expect(worthKeeping({ ...draft, bars: [null, null], tries: 0, angle: 52, power: 45 }, fresh)).toBe(false);
    expect(worthKeeping({ ...draft, bars: [null, null], tries: 0, angle: 52, power: 46 }, fresh)).toBe(true);
    expect(worthKeeping(draft, fresh)).toBe(true);
  });
});
