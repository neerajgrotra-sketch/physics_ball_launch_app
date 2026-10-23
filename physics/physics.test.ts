import { describe, it, expect } from 'vitest';
import { buildWorld, simulate, solutionPieces, inputGrid, glassBox, BALL_RADIUS, LAUNCHER, WALL_RESTITUTION, WORLD, type Level } from './index';
import { LEVELS } from '../levels';
import { legalPlacement } from '../tools/geometry';
import { usesEveryBar } from '../tools/find-solution';

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

describe('true bounces', () => {
  it('a flat bar reflects the ball: speed along it kept, speed into it reversed and scaled by 0.85', () => {
    // Fire straight up at the lowest power; the ball falls back onto a flat bar just under the launcher.
    const level: Level = { id: 't', name: 't', hint: '', glass: { x: 350, w: 40, h: 50 }, fixed: [], pieces: [{ len: 90 }] };
    const bar = { len: 90, x: LAUNCHER.x, y: LAUNCHER.y + 18, deg: 0 };
    const r = simulate(buildWorld(level, [bar]), 90, 0, 1);
    const k = r.hits[0].i;
    const before = r.path[k - 2][1] - r.path[k - 3][1], after = r.path[k + 1][1] - r.path[k][1];
    expect(Math.sign(before)).toBe(1);             // falling
    expect(Math.sign(after)).toBe(-1);             // bounced back up
    expect(Math.abs(after / before)).toBeGreaterThan(0.7);
    expect(Math.abs(after / before)).toBeLessThan(0.95);
    for (const [x] of r.path.slice(0, k + 20)) expect(x).toBeCloseTo(LAUNCHER.x, 6); // a straight drop stays straight
  });
});

describe('bounce events', () => {
  it('every solution bounces off every bar, each event points at a real path point, in order', () => {
    for (const level of LEVELS) {
      const s = level.solution!;
      const placed = solutionPieces(level);
      const r = simulate(buildWorld(level, placed), s.angle, s.power);
      expect(usesEveryBar(level, placed, s.angle, s.power)).toBe(true);
      for (const h of r.hits) {
        expect(h.i).toBeGreaterThan(0);
        expect(h.i).toBeLessThan(r.path.length);
        expect(h.speed).toBeGreaterThan(0);
      }
      expect(r.hits.map(h => h.i)).toEqual([...r.hits.map(h => h.i)].sort((a, b) => a - b));
    }
  });

  it('recording them changes nothing about the shot, and the solver skips them', () => {
    const level = LEVELS[0], s = level.solution!;
    const w = buildWorld(level, solutionPieces(level));
    const full = simulate(w, s.angle, s.power);
    const fast = simulate(w, s.angle, s.power, Infinity);
    expect([fast.success, fast.end, fast.t]).toEqual([full.success, full.end, full.t]);
    expect(fast.path[fast.path.length - 1]).toEqual(full.path[full.path.length - 1]);
    expect(fast.hits).toEqual([]);
  });
});

describe('rules', () => {
  it('a plain lob into the glass does not win: it needs a bar', () => {
    const w = buildWorld(LEVELS[0], []);
    let lob = null;
    for (const angle of inputGrid(20, 80, 0.5)) for (const power of inputGrid(0, 100, 0.5)) {
      const r = simulate(w, angle, power, Infinity);
      if (r.end === 'skipped') { lob = r; break; }
    }
    expect(lob, 'expected some lob to land in the open glass').not.toBeNull();
    expect(lob!.success).toBe(false);
  });

  it('a win needs every bar the level gives placed and hit', () => {
    // Level 1's stored shot, which lands off its one bar.
    const one = LEVELS[0], s = one.solution!, bar = solutionPieces(one);
    expect(simulate(buildWorld(one, bar), s.angle, s.power).success).toBe(true);

    // The same shot on a level that gives two bars: one placed is not enough...
    const two: Level = { ...one, pieces: [{ len: 90 }, { len: 90 }] };
    const short = simulate(buildWorld(two, bar), s.angle, s.power);
    expect([short.success, short.end]).toEqual([false, 'skipped']);

    // ...and neither is placing the second where the ball never touches it.
    const unused = { len: 90, x: 330, y: 80, deg: 0 };
    const missed = simulate(buildWorld(two, [...bar, unused]), s.angle, s.power);
    expect([missed.success, missed.end]).toEqual([false, 'skipped']);
    expect(missed.touched).toEqual([true, false]);
  });

  it('the floor and edges keep the ball on the board, and every shot comes to an end', () => {
    const w = buildWorld(LEVELS[0], []);
    for (let angle = 0; angle <= 90; angle += 5) for (const power of [0, 50, 100]) {
      const r = simulate(w, angle, power, 1);
      expect(r.end).not.toBe('timeout');
      expect(r.end).not.toBe('out');
      for (const [x, y] of r.path) {
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(WORLD.width);
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(WORLD.ground);
      }
    }
  });

  it('the floor and edges bounce, a bit softer than a bar', () => {
    const r = simulate(buildWorld(LEVELS[0], []), 30, 100);
    const walls = r.hits.filter(h => h.kind === 'wall');
    expect(walls.length).toBeGreaterThan(1);
    expect(WALL_RESTITUTION).toBeLessThan(0.85);
  });

  it('the ball never passes through the glass walls (tunnelling)', () => {
    // Fast shots at the glass from every angle: the ball is either outside the glass or entered over the rim.
    const level = LEVELS[0], g = glassBox(level.glass), w = buildWorld(level, []);
    for (const angle of inputGrid(0, 90, 1)) {
      const r = simulate(w, angle, 100, 1);
      for (let i = 1; i < r.path.length; i++) {
        const [x0, y0] = r.path[i - 1], [x1, y1] = r.path[i];
        const crossesWall = (y0 > g.rim + BALL_RADIUS && y1 > g.rim + BALL_RADIUS && y1 < g.base) &&
          ((x0 < g.l && x1 > g.l) || (x0 > g.r && x1 < g.r));
        expect(crossesWall).toBe(false);
      }
    }
  });
});

describe.each(LEVELS.map(l => [l.id, l] as const))('level %s', (_id, level) => {
  it('has a unique id and at least one piece', () => {
    expect(LEVELS.filter(l => l.id === level.id)).toHaveLength(1);
    expect(level.pieces.length).toBeGreaterThan(0);
  });

  it('stored solution is legal, uses every bar and lands', () => {
    expect(level.solution, 'run tools/design-levels.ts').toBeDefined();
    const placed = solutionPieces(level);
    expect(placed).toHaveLength(level.pieces.length);
    expect(legalPlacement(level, placed)).toBe(true);
    const s = level.solution!;
    expect(simulate(buildWorld(level, placed), s.angle, s.power).success).toBe(true);
    expect(usesEveryBar(level, placed, s.angle, s.power)).toBe(true);
  });

  // Holds by rule (a win needs a bar); this guards against regressions in that rule.
  it('cannot be won without pieces (0.5-step sweep)', () => {
    const w = buildWorld(level, []);
    for (const angle of inputGrid(0, 90, 0.5)) for (const power of inputGrid(0, 100, 0.5))
      expect(simulate(w, angle, power, Infinity).success).toBe(false);
  });
});
