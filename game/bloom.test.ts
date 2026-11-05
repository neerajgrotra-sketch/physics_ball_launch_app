import { describe, expect, it } from 'vitest';
import { BLOOM_MS, BLOOM_PHASES, BLOOM_TIERS, bloomFor, emberAt, embers, rose, fireflies, fireflyAt, phase, spirograph } from './bloom';

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

  it('keeps the full light bloom for three stars, and gives each tier its own', () => {
    const [one, two, three] = [bloomFor(1, false), bloomFor(2, false), bloomFor(3, false)];
    expect(three).toMatchObject({ beam: true, halo: 'white', mandalas: 2, ms: BLOOM_MS, sound: 'bloom' });
    // Only three stars gets the white light, the column and the mandalas.
    expect([one.halo, two.halo]).not.toContain('white');
    expect(one.beam || two.beam || one.mandalas > 0 || two.mandalas > 0).toBe(false);
    // Each has its own: the constellation and flower for two, the embers for one.
    expect(two).toMatchObject({ constellation: true, flower: true, embers: 0 });
    expect(one.embers).toBeGreaterThan(0);
    expect(one.constellation || one.flower || three.constellation || three.flower || three.embers > 0).toBe(false);
    // Each step up is longer and has more going on.
    for (const k of ['ms', 'rings', 'flies'] as const) {
      expect(three[k]).toBeGreaterThan(two[k]);
      expect(two[k]).toBeGreaterThanOrEqual(one[k]);
    }
    expect(two.ms).toBeGreaterThan(one.ms);
    expect(one.fill).toBeLessThan(two.fill);
    // A helped win, or no stars, gets the smallest.
    expect(bloomFor(3, true)).toBe(BLOOM_TIERS[1]);
    expect(bloomFor(0, false)).toBe(BLOOM_TIERS[1]);
  });

  it('draws a flower with its petals reaching the size, and embers that rise and go out', () => {
    const pts = rose(5, 50);
    expect(Math.max(...pts.map(([x, y]) => Math.hypot(x, y)))).toBeCloseTo(50, 0);
    for (const e of embers(16)) {
      expect(emberAt(e, 200, 400, 0)[2]).toBe(0);
      const mid = emberAt(e, 200, 400, e.delay + e.life / 2);
      expect(mid[1]).toBeLessThan(400);
      expect(mid[2]).toBeGreaterThan(0);
      expect(emberAt(e, 200, 400, 1)[2]).toBe(0);
    }
  });
});
