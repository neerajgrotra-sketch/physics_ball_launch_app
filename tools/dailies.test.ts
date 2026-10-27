import { describe, expect, it } from 'vitest';
import { buildWorld, simulate, solutionPieces } from '../physics';
import { DAILIES } from '../levels/daily';
import { legalPlacement } from './geometry';
import { usesEveryBar } from './find-solution';

describe('daily puzzles', () => {
  it('a whole number of weeks, each puzzle on its weekday tier, numbered in order', () => {
    expect(DAILIES.length % 7).toBe(0);
    expect(DAILIES.length).toBeGreaterThan(0);
    DAILIES.forEach((d, i) => expect(d.id).toBe(`daily-${String(i + 1).padStart(3, '0')}`));
  });

  it('every stored answer is legal, lands, uses every bar and takes par', () => {
    for (const level of DAILIES) {
      const s = level.solution!;
      const placed = solutionPieces(level);
      expect(legalPlacement(level, placed), level.id).toBe(true);
      expect(Math.round(s.angle * 10) / 10, level.id).toBe(s.angle);
      const r = simulate(buildWorld(level, placed), s.angle, s.power);
      expect(r.success, level.id).toBe(true);
      expect(usesEveryBar(level, placed, s.angle, s.power), level.id).toBe(true);
      expect(level.par, level.id).toBe(r.bounces);
    }
  });
});
