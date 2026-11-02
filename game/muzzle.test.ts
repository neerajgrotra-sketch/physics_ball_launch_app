import { describe, expect, it } from 'vitest';
import { LAUNCHER } from '../physics';
import { RECOIL, blastPuffs, blastSparks, muzzle, recoilAt } from './muzzle';

describe('launch blast', () => {
  it('puts the muzzle at the end of the barrel, along the aim', () => {
    const flat = muzzle('pirate', 0);
    expect(flat.at[0]).toBeCloseTo(LAUNCHER.x + 34);
    expect(flat.at[1]).toBeCloseTo(LAUNCHER.y);
    const up = muzzle('classic', 90);
    expect(up.at[0]).toBeCloseTo(LAUNCHER.x);
    expect(up.at[1]).toBeCloseTo(LAUNCHER.y - 27);
    expect(muzzle('unknown', 45).at).toEqual(muzzle('classic', 45).at);
  });

  it('throws the sparks forward in a cone, fastest down the middle', () => {
    const sparks = blastSparks(15);
    for (const s of sparks) expect(Math.abs(s.off)).toBeLessThan(0.65);
    expect(sparks[7].speed).toBeGreaterThan(sparks[0].speed);
    expect(blastPuffs(6).map((p) => p.delay)).toEqual([0, 0.05, 0.1, 0.15, 0.2, 0.25].map((d) => expect.closeTo(d)));
  });

  it('kicks back sharply and settles', () => {
    expect(recoilAt(0)).toBe(0);
    expect(recoilAt(0.04)).toBeCloseTo(RECOIL);
    expect(recoilAt(0.5)).toBe(0);
    expect(recoilAt(0.1)).toBeGreaterThan(recoilAt(0.2));
  });
});
