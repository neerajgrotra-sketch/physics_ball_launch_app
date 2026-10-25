import { describe, it, expect } from 'vitest';
import { buildWorld, simulate, solutionPieces, inputGrid, glassBox, blockCorners, hazardReach, SPIKE_LENGTH, BALL_RADIUS, LAUNCHER, WALL_RESTITUTION, PAD_KICK, MAX_BALL_SPEED, WORLD, type Level } from './index';
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

describe('fixed bouncy blocks', () => {
  const base: Level = { id: 't', name: 't', hint: '', glass: { x: 360, w: 40, h: 50 }, fixed: [], pieces: [{ len: 90 }] };

  it('have four corners, turned by deg about their centre', () => {
    expect(blockCorners({ x: 100, y: 200, w: 40, h: 20 })).toEqual([[80, 190], [120, 190], [120, 210], [80, 210]]);
    const t = blockCorners({ x: 0, y: 0, w: 20, h: 10, deg: 90 });
    expect(t[0][0]).toBeCloseTo(5, 9); expect(t[0][1]).toBeCloseTo(-10, 9);
  });

  it('bounce the ball back, softly, without ending the shot', () => {
    // A tall block right in front of the launcher; a flat shot hits it and comes back.
    const level: Level = { ...base, blocks: [{ x: 120, y: 400, w: 30, h: 300 }] };
    const r = simulate(buildWorld(level, []), 20, 60);
    expect(r.hits.some((h) => h.kind === 'block')).toBe(true);
    expect(r.end).not.toBe('dead');
    expect(Math.max(...r.path.map((p) => p[0]))).toBeLessThan(120);   // never got past it
    expect(r.hits.filter((h) => h.kind === 'block').every((h) => h.counts)).toBe(true); // a block bounce is scored
  });

  it('are kept clear of when placing bars', () => {
    const level: Level = { ...base, blocks: [{ x: 200, y: 300, w: 40, h: 40 }] };
    expect(legalPlacement(level, [{ len: 90, x: 200, y: 300, deg: 0 }])).toBe(false);
    expect(legalPlacement(level, [{ len: 90, x: 200, y: 450, deg: 0 }])).toBe(true);
  });
});

describe('spiked hazards', () => {
  const base: Level = { id: 't', name: 't', hint: '', glass: { x: 360, w: 40, h: 50 }, fixed: [], pieces: [{ len: 90 }] };

  it('reach out to their spike tips', () => {
    const h = { x: 200, y: 300, w: 40, h: 20 };
    expect(hazardReach(h)).toMatchObject({ x: 200, y: 300, w: 40 + 2 * SPIKE_LENGTH, h: 20 + 2 * SPIKE_LENGTH });
  });

  it('destroy the ball: the shot ends there, as dead', () => {
    // A tall spiked wall right in front of the launcher; a flat shot hits it.
    const level: Level = { ...base, hazards: [{ x: 120, y: 400, w: 24, h: 300 }] };
    const r = simulate(buildWorld(level, []), 20, 60);
    expect(r.end).toBe('dead');
    expect(r.success).toBe(false);
    expect(Math.max(...r.path.map((p) => p[0]))).toBeLessThan(120);   // never got past it
    // ...and the same shot with no hazard carries on.
    expect(simulate(buildWorld(base, []), 20, 60).end).not.toBe('dead');
  });

  it('are kept clear of when placing bars', () => {
    const level: Level = { ...base, hazards: [{ x: 200, y: 300, w: 40, h: 20 }] };
    expect(legalPlacement(level, [{ len: 90, x: 200, y: 300, deg: 0 }])).toBe(false);
    expect(legalPlacement(level, [{ len: 90, x: 200, y: 330, deg: 0 }])).toBe(false);   // within the spike tips plus a ball's width
    expect(legalPlacement(level, [{ len: 90, x: 200, y: 450, deg: 0 }])).toBe(true);
  });
});

describe('bounce count', () => {
  it('counts real bounces outside the glass, not rattling inside it', () => {
    // Straight up and back down onto a flat bar under the launcher: it bounces there until it settles.
    const level: Level = { id: 't', name: 't', hint: '', glass: { x: 350, w: 40, h: 50 }, fixed: [], pieces: [{ len: 90 }] };
    const r = simulate(buildWorld(level, [{ len: 90, x: LAUNCHER.x, y: LAUNCHER.y + 18, deg: 0 }]), 90, 0);
    expect(r.bounces).toBeGreaterThan(1);
    expect(r.hits.filter((h) => h.counts)).toHaveLength(r.bounces);
    for (const level of LEVELS) {
      const s = level.solution!;
      const w = buildWorld(level, solutionPieces(level));
      const res = simulate(w, s.angle, s.power);
      for (const h of res.hits) {
        const [x, y] = res.path[Math.min(h.i, res.path.length - 1)];
        if (h.counts) expect(x > w.glass.l + 1 && x < w.glass.r - 1 && y > w.glass.rim + 4).toBe(false);
      }
    }
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
    const one = LEVELS.find((l) => l.id === '01-first-bounce')!, s = one.solution!, bar = solutionPieces(one);
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

  it('has a par: the stored solution takes exactly that many bounces, at least one per bar', () => {
    const s = level.solution!;
    const r = simulate(buildWorld(level, solutionPieces(level)), s.angle, s.power);
    expect(level.par, 'run tools/design-levels.ts').toBe(r.bounces);
    expect(level.par!).toBeGreaterThanOrEqual(level.pieces.length);
    expect(r.hits.filter((h) => h.counts)).toHaveLength(r.bounces);
  });

  // Holds by rule (a win needs a bar); this guards against regressions in that rule.
  it('cannot be won without pieces (0.5-step sweep)', () => {
    const w = buildWorld(level, []);
    for (const angle of inputGrid(0, 90, 0.5)) for (const power of inputGrid(0, 100, 0.5))
      expect(simulate(w, angle, power, Infinity).success).toBe(false);
  });
});

describe('spring pads', () => {
  const base: Level = { id: 't', name: 't', hint: '', glass: { x: 360, w: 40, h: 50 }, fixed: [], pieces: [{ len: 90 }] };
  const pad = { x: 200, y: 520, w: 80, h: 14 };

  it('throw the ball back faster than it arrived, with a kick', () => {
    // Straight up from x = 44 is not over the pad, so drop the ball onto it by launching from a pad near the launcher.
    const level: Level = { ...base, pads: [{ x: 44, y: 536, w: 60, h: 8 }] };
    const r = simulate(buildWorld(level, []), 90, 20);
    const hit = r.hits.find((h) => h.kind === 'pad');
    expect(hit).toBeDefined();
    expect(hit!.counts).toBe(true);
    // After the kick the ball rises higher than the free-flight apex it fell from.
    const apex1 = Math.min(...r.path.slice(0, hit!.i).map((p) => p[1]));
    const apex2 = Math.min(...r.path.slice(hit!.i, hit!.i + 240).map((p) => p[1]));
    expect(apex2).toBeLessThan(apex1);
  });

  it('kick even a ball dropped gently, and never above the speed cap', () => {
    expect(PAD_KICK).toBeGreaterThan(0);
    const level: Level = { ...base, pads: [{ x: 44, y: 536, w: 60, h: 8 }] };
    for (const [a, p] of [[90, 5], [90, 60], [90, 100], [75, 100]]) {
      const r = simulate(buildWorld(level, []), a, p);
      for (let i = 1; i < r.path.length; i++) {
        const sp = Math.hypot(r.path[i][0] - r.path[i - 1][0], r.path[i][1] - r.path[i - 1][1]) * 120;
        expect(sp).toBeLessThan(MAX_BALL_SPEED * 1.35);
      }
    }
  });

  it('are kept clear of when placing bars', () => {
    const level: Level = { ...base, pads: [pad] };
    expect(legalPlacement(level, [{ len: 90, x: 200, y: 520, deg: 0 }])).toBe(false);
    expect(legalPlacement(level, [{ len: 90, x: 200, y: 400, deg: 0 }])).toBe(true);
  });
});

describe('a win needs every spring pad touched', () => {
  it('lands without touching the pad: skipped, not a win', () => {
    const base = LEVELS[1];
    const s = base.solution!;
    const plain = simulate(buildWorld(base, solutionPieces(base)), s.angle, s.power);
    expect(plain.success).toBe(true);
    // A pad the ball never goes near.
    const padded: Level = { ...base, pads: [{ x: 200, y: 60, w: 40, h: 10 }] };
    const r = simulate(buildWorld(padded, solutionPieces(padded)), s.angle, s.power);
    expect(r.success).toBe(false);
    expect(r.end).toBe('skipped');
    expect(r.padsTouched).toEqual([false]);
  });

  it('every pad level has a stored answer that touches all its pads', () => {
    for (const l of LEVELS.filter((x) => x.pads?.length)) {
      const s = l.solution!;
      const r = simulate(buildWorld(l, solutionPieces(l)), s.angle, s.power);
      expect(r.success).toBe(true);
      expect(r.padsTouched.every(Boolean)).toBe(true);
    }
  });
});

describe('spring bars (restitution above 1)', () => {
  it('throw the ball back harder than a plain bar, and the stored answer of Trampoline needs the spring', () => {
    const l = LEVELS.find((x) => x.id === '20-trampoline')!;
    const s = l.solution!;
    const r = simulate(buildWorld(l, solutionPieces(l)), s.angle, s.power);
    expect(r.success).toBe(true);
    expect(r.hits.some((h) => h.spring)).toBe(true);
    const plain: Level = { ...l, pieces: l.pieces.map((p) => ({ ...p, restitution: undefined })) };
    expect(simulate(buildWorld(plain, solutionPieces(plain)), s.angle, s.power).success).toBe(false);
  });
});

describe('portals', () => {
  const base: Level = { id: 't', name: 't', hint: '', glass: { x: 360, w: 40, h: 50 }, fixed: [], pieces: [{ len: 90 }] };

  it('carry the ball from one end to the other with its speed kept', () => {
    // Fire straight up from the launcher at x = 44: a portal in its way at (44, 300) lets it out at (200, 300), still going up.
    const level: Level = { ...base, portals: [{ a: { x: 44, y: 300 }, b: { x: 200, y: 300 } }] };
    const r = simulate(buildWorld(level, []), 90, 60);
    expect(r.portalsUsed).toEqual([true]);
    expect(r.jumps.length).toBeGreaterThanOrEqual(1);
    const j = r.jumps[0];
    expect(r.path[j]).toEqual([200, 300]);
    // The move across is a jump, not travel: the point before it is near the entry, the one after is the exit.
    expect(Math.hypot(r.path[j - 1][0] - 44, r.path[j - 1][1] - 300)).toBeLessThan(15);
    // Speed is kept: the next steps rise at about the speed that went in.
    const into = Math.abs(r.path[j - 1][1] - r.path[j - 2][1]), out = Math.abs(r.path[j + 2][1] - r.path[j + 1][1]);
    expect(out).toBeGreaterThan(into * 0.9);
    expect(out).toBeLessThan(into * 1.1);
    expect(Math.max(...r.path.map((p) => p[0]))).toBeGreaterThan(190);
  });

  it('turn the heading by `turn` degrees on the way out', () => {
    const level: Level = { ...base, portals: [{ a: { x: 44, y: 300 }, b: { x: 200, y: 300 }, turn: 90 }] };
    const r = simulate(buildWorld(level, []), 90, 60);
    const j = r.jumps[0];
    // Going up (-y) turned a quarter turn clockwise (towards +x on screen) leaves moving right.
    expect(r.path[j + 4][0]).toBeGreaterThan(r.path[j][0] + 1);
  });

  it('Wormhole: the stored answer goes through the portal and wins', () => {
    const level = LEVELS.find((x) => x.id === '21-wormhole')!;
    const s = level.solution!;
    const r = simulate(buildWorld(level, solutionPieces(level)), s.angle, s.power);
    expect(r.success).toBe(true);
    expect(r.portalsUsed.every(Boolean)).toBe(true);
    expect(r.jumps.length).toBeGreaterThanOrEqual(1);
  });

  it('a landing that skipped the portal is not a win', () => {
    const first = LEVELS[1];
    const s = first.solution!;
    const withPortal: Level = { ...first, portals: [{ a: { x: 200, y: 40 }, b: { x: 300, y: 40 } }] };
    const r = simulate(buildWorld(withPortal, solutionPieces(withPortal)), s.angle, s.power);
    expect(r.portalsUsed).toEqual([false]);
    expect(r.success).toBe(false);
  });

  it('are kept clear of when placing bars', () => {
    const level: Level = { ...base, portals: [{ a: { x: 200, y: 300 }, b: { x: 300, y: 300 } }] };
    expect(legalPlacement(level, [{ len: 90, x: 200, y: 300, deg: 0 }])).toBe(false);
    expect(legalPlacement(level, [{ len: 90, x: 200, y: 400, deg: 0 }])).toBe(true);
  });
});
