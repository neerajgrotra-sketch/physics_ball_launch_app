import { describe, it, expect } from 'vitest';
import { buildWorld, simulate, solutionPieces, inputGrid, WORLD } from './index';
import { LEVELS } from '../levels';
import { legalPlacement } from '../tools/geometry';

describe('determinism', () => {
  it('same input gives an identical path', () => {
    const level = LEVELS[4];
    const placed = [{ len: 90, x: 200, y: 300, deg: 23 }];
    const a = simulate(buildWorld(level, placed), 47.3, 71.9);
    const b = simulate(buildWorld(level, placed), 47.3, 71.9);
    expect(b.path).toEqual(a.path);
    expect(b.end).toBe(a.end);
  });
});

describe('dead surfaces', () => {
  it('the ball never leaves the world and every shot ends', () => {
    const w = buildWorld(LEVELS[0], []);
    for (let angle = 0; angle <= 90; angle += 5) {
      const r = simulate(w, angle, 100, 1);
      expect(r.end).not.toBe('timeout');
      for (const [x, y] of r.path) {
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(WORLD.width);
        expect(y).toBeLessThan(WORLD.ground); // a dead hit ends the shot at contact
      }
    }
  });
});

describe.each(LEVELS.map(l => [l.id, l] as const))('level %s', (_id, level) => {
  it('has a unique id and at least one piece', () => {
    expect(LEVELS.filter(l => l.id === level.id)).toHaveLength(1);
    expect(level.pieces.length).toBeGreaterThan(0);
  });

  it('stored solution is legal and lands', () => {
    expect(level.solution, 'run tools/design-levels.ts').toBeDefined();
    const placed = solutionPieces(level);
    expect(legalPlacement(level, placed)).toBe(true);
    const s = level.solution!;
    expect(simulate(buildWorld(level, placed), s.angle, s.power).success).toBe(true);
  });

  // Coarse version of the exhaustive proof. The full 0.1-step proof runs in tools/report.ts
  // and tools/design-levels.ts (about a minute per level), so run it before merging level changes.
  it('cannot be solved without pieces (0.5-step sweep)', () => {
    const w = buildWorld(level, []);
    for (const angle of inputGrid(0, 90, 0.5)) for (const power of inputGrid(0, 100, 0.5))
      expect(simulate(w, angle, power, Infinity).success).toBe(false);
  });
});
