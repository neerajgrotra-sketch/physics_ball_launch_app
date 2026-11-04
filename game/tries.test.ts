import { describe, expect, it } from 'vitest';
import { isRerun, setupKey } from './tries';

describe('what counts as a try', () => {
  const bars = [{ x: 120, y: 200, deg: -30 }, { x: 300, y: 410, deg: 0 }];
  it('the same bars and aim are the same setup; any change is a new one', () => {
    const key = setupKey(bars, 52, 45);
    expect(isRerun(key, setupKey(bars.map((b) => ({ ...b })), 52, 45))).toBe(true);
    expect(isRerun(key, setupKey([{ ...bars[0], deg: -31 }, bars[1]], 52, 45))).toBe(false);
    expect(isRerun(key, setupKey(bars, 52.1, 45))).toBe(false);
    expect(isRerun(key, setupKey(bars, 52, 45.1))).toBe(false);
    expect(isRerun(key, setupKey(bars.slice(0, 1), 52, 45))).toBe(false);
  });
  it('before any shot nothing is a replay', () => {
    expect(isRerun('', setupKey([], 52, 45))).toBe(false);
  });
});
