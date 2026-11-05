import { describe, expect, it } from 'vitest';
import { BLOOM_MS, BLOOM_PHASES, BLOOM_TIERS, bloomFor, fireflies, fireflyAt, phase, spirograph } from './bloom';

describe('ASMR win bloom', () => {
  it('draws a closed spirograph that reaches its size', () => {
    const pts = spirograph(7, 4, 5, 60);
    const [a, b] = [pts[0], pts[pts.length - 1]];
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(1e-6);
    const far = Math.max(...pts.map(([x, y]) => Math.hypot(x, y)));
    expect(far).toBeCloseTo(60, 0);
  });

  it('runs each phase from 0 to 1 inside its window', () => {
    expect(phase(0, BLOOM_PHASES.fill)).toBe(0);
    expect(phase(1, BLOOM_PHASES.fill)).toBe(1);
    expect(phase(0.325, BLOOM_PHASES.fill)).toBeCloseTo(0.5);
    for (const [a, b] of Object.values(BLOOM_PHASES)) { expect(a).toBeLessThan(b); expect(b).toBeLessThanOrEqual(1); }
  });

  it('brings every firefly into the glass', () => {
    for (const f of fireflies(28)) {
      const [x, y] = fireflyAt(f, 200, 500, 1);
      expect(Math.hypot(x - 200, y - 500)).toBeLessThan(1e-9);
      const [sx, sy] = fireflyAt(f, 200, 500, 0);
      expect(Math.hypot(sx - 200, (sy - 500) / 0.8)).toBeCloseTo(f.r0);
    }
  });

  it('keeps the full light bloom for three stars', () => {
    const [one, two, three] = [bloomFor(1, false), bloomFor(2, false), bloomFor(3, false)];
    expect(three).toMatchObject({ beam: true, halo: 'white', mandalas: 2, ms: BLOOM_MS, sound: 'bloom' });
    // Only three stars gets the white light.
    expect([one.halo, two.halo]).not.toContain('white');
    expect(one.beam || two.beam).toBe(false);
    // Each step down is smaller and shorter.
    for (const k of ['ms', 'rings', 'flies', 'mandalas'] as const) {
      expect(three[k]).toBeGreaterThan(two[k]);
      expect(two[k]).toBeGreaterThan(one[k]);
    }
    expect(one.fill).toBeLessThan(two.fill);
    // A helped win, or no stars, gets the smallest.
    expect(bloomFor(3, true)).toBe(BLOOM_TIERS[1]);
    expect(bloomFor(0, false)).toBe(BLOOM_TIERS[1]);
  });
});
