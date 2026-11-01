import { describe, expect, it } from 'vitest';
import { DEFAULT_TRAILS, MAX_TRAILS, TRAIL_CHOICES, parseTrails, trailOpacity } from './trails';

describe('trails setting', () => {
  it('defaults to 3 and only accepts listed choices', () => {
    expect(DEFAULT_TRAILS).toBe(3);
    expect(parseTrails(null)).toBe(3);
    expect(parseTrails('7')).toBe(3);
    expect(parseTrails('junk')).toBe(3);
    for (const n of TRAIL_CHOICES) expect(parseTrails(String(n))).toBe(n);
    expect(MAX_TRAILS).toBe(Math.max(...TRAIL_CHOICES));
  });
  it('fades older trails, newest strongest', () => {
    for (const n of TRAIL_CHOICES) {
      const ops = Array.from({ length: n }, (_, i) => trailOpacity(i, n));
      expect(ops[n - 1]).toBeCloseTo(0.6);
      for (let i = 1; i < n; i++) expect(ops[i]).toBeGreaterThan(ops[i - 1]);
      if (n > 1) expect(ops[0]).toBeCloseTo(0.1);
    }
  });
});
