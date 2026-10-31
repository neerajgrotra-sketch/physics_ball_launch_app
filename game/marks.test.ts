import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels';
import { buildWorld, simulate, solutionPieces } from '../physics';
import { bounceMarks } from './marks';

describe('bounce markers', () => {
  it('number every scored bounce, so they always add up to the shot’s bounce count', () => {
    for (const l of LEVELS) {
      if (!l.solution) continue;
      const res = simulate(buildWorld(l, solutionPieces(l)), l.solution.angle, l.solution.power);
      const marks = bounceMarks(res);
      expect(marks.length).toBe(res.bounces);
      expect(marks.map((m) => m.n)).toEqual(marks.map((_, k) => k + 1));
    }
  });
});
