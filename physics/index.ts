/**
 * Bank Shot physics: pure, deterministic, UI-free.
 * Rules: no imports from React/Expo/Skia, no Math.random, no Date/performance.
 * Same (level, pieces, angle, power) must always produce the identical path.
 *
 * Rules of the game:
 * - True bounces: a collision reflects the ball's velocity about the surface normal, scaled by the
 *   surface's restitution, with a little friction along it, under constant gravity.
 * - The bars, the glass, the floor and all four board edges are solid and bounce. The floor and edges
 *   are a little softer than a bar, so a stray ball loses energy and comes to rest. Fixed (grey)
 *   obstacles, if a level has any, are dead: touching one ends the shot.
 * - A win needs a bar: the ball must touch at least one of the player's bars before it settles in the
 *   glass. A plain lob into the glass doesn't count, so no level can be won without bars, by rule.
 *   Each level's stored solution goes further and uses every bar it gives.
 */

export const WORLD = { width: 400, height: 720, ground: 700 } as const;
export const LAUNCHER = { x: 44, y: 672 } as const;
export const BALL_RADIUS = 8;
export const GRAVITY = 900;          // px/s²
export const DT = 1 / 240;           // fixed timestep; never tie this to frame rate
export const MAX_SIM_SECONDS = 14;
export const SETTLE_IN_GLASS_S = 0.35;
export const REST_SPEED = 10;        // px/s
export const REST_TIME_S = 0.6;
export const RESTING_CONTACT_SPEED = 40; // below this, bounces are killed to stop jitter
/** Bounciness of the floor and board edges: a bit softer than a bar (0.85). */
export const WALL_RESTITUTION = 0.7;
/** Friction along the floor and edges, so a ball rolling on the floor slows to rest. */
export const WALL_FRICTION = 0.03;
/** The glass stands on a plate this much wider than the glass on each side. */
export const PLATE_OVERHANG = 8;
export const ANGLE_STEP = 0.1;       // the only angle values a player can enter
export const POWER_STEP = 0.1;       // the only power values a player can enter

export type Vec = [number, number];
/** Fixed (dead) obstacle: [x1, y1, x2, y2] */
export type FixedSegment = [number, number, number, number];

/** `base` is the y of the glass floor; it defaults to WORLD.ground. */
export interface Glass { x: number; w: number; h: number; base?: number }
export interface PieceSpec { len: number; restitution?: number }
/** A piece the player has placed. `deg` is rotation in whole degrees. */
export interface PlacedPiece { len: number; x: number; y: number; deg: number; restitution?: number }
export interface Solution { pieces: { x: number; y: number; deg: number }[]; angle: number; power: number }
export interface Level {
  id: string;
  name: string;
  hint: string;
  glass: Glass;
  fixed: FixedSegment[];
  pieces: PieceSpec[];
  /** One verified answer, shown by the Solve button. pieces[i] matches level.pieces[i]. */
  solution?: Solution;
}

export type SegmentKind = 'dead' | 'glass' | 'piece' | 'wall';
/** `piece` is the index of the placed piece a 'piece' segment belongs to. */
export interface Segment { x1: number; y1: number; x2: number; y2: number; e: number; f: number; kind: SegmentKind; piece?: number }
export interface World {
  segs: Segment[];
  glass: { l: number; r: number; rim: number; base: number };
  /** How many pieces are placed. */
  placedCount: number;
}
/**
 * How a shot ended. 'glass': settled in the glass after touching a bar (a win). 'skipped': settled in
 * the glass without touching any bar. 'dead': hit a grey obstacle. 'rest': stopped somewhere else.
 * 'out': left the board, which the edges should make impossible (kept as a safety net).
 */
export type EndReason = 'glass' | 'skipped' | 'out' | 'dead' | 'rest' | 'timeout';
/** A real bounce (not resting contact) off a piece, the glass or a wall. `i` is the index of the next path point. */
export interface Hit { i: number; kind: 'piece' | 'glass' | 'wall'; speed: number; piece?: number }
export interface SimResult { path: Vec[]; success: boolean; t: number; end: EndReason; hits: Hit[] }

export function speedFor(power: number): number {
  return 280 + power * 8.4; // power 0..100 → 280..1120 px/s
}

export function pieceEnds(p: { len: number; x: number; y: number; deg: number }): [number, number, number, number] {
  const a = (p.deg * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a), h = p.len / 2;
  return [p.x - c * h, p.y - s * h, p.x + c * h, p.y + s * h];
}

export function glassBox(g: Glass) {
  const base = g.base ?? WORLD.ground;
  return { l: g.x - g.w / 2, r: g.x + g.w / 2, rim: base - g.h, base };
}

/** Pieces from a stored solution, ready to pass to buildWorld. */
export function solutionPieces(level: Level): PlacedPiece[] {
  const s = level.solution;
  if (!s) return [];
  return s.pieces.map((p, i) => ({ ...p, len: level.pieces[i].len, restitution: level.pieces[i].restitution }));
}

export function buildWorld(level: Level, placed: PlacedPiece[]): World {
  const segs: Segment[] = [];
  const add = (x1: number, y1: number, x2: number, y2: number, e: number, f: number, kind: SegmentKind, piece?: number) =>
    segs.push({ x1, y1, x2, y2, e, f, kind, piece });

  // Floor and the four board edges.
  const { width: W, ground: GROUND } = WORLD;
  const wall = (x1: number, y1: number, x2: number, y2: number) => add(x1, y1, x2, y2, WALL_RESTITUTION, WALL_FRICTION, 'wall');
  wall(0, GROUND, W, GROUND);
  wall(0, 0, 0, GROUND);
  wall(W, 0, W, GROUND);
  wall(0, 0, W, 0);

  // The glass: two walls and a plate that it stands on, a little wider than the glass.
  const { l, r, rim, base } = glassBox(level.glass);
  add(l, rim, l, base, 0.35, 0.02, 'glass');
  add(r, rim, r, base, 0.35, 0.02, 'glass');
  add(l - PLATE_OVERHANG, base, r + PLATE_OVERHANG, base, 0.3, 0.05, 'glass');

  for (const s of level.fixed) add(s[0], s[1], s[2], s[3], 0, 0, 'dead');
  placed.forEach((p, k) => {
    const [x1, y1, x2, y2] = pieceEnds(p);
    add(x1, y1, x2, y2, p.restitution ?? 0.85, 0.01, 'piece', k);
  });
  return { segs, glass: { l, r, rim, base }, placedCount: placed.length };
}

export function inGlass(world: World, x: number, y: number): boolean {
  const g = world.glass;
  return x > g.l && x < g.r && y > g.rim + BALL_RADIUS * 0.5 && y < g.base;
}

/** Outside the board. The floor and edges keep the ball in; this is a safety net. */
function offBoard(x: number, y: number): boolean {
  const m = BALL_RADIUS * 2;
  return x < -m || x > WORLD.width + m || y < -m || y > WORLD.height + m;
}

/**
 * Simulate one launch.
 * @param recordEvery record a path point every N steps (2 → 120 points/s, matches playback).
 *                    Pass Infinity in the solver to skip path building (and bounce events).
 */
export function simulate(world: World, angleDeg: number, power: number, recordEvery = 2): SimResult {
  const R = BALL_RADIUS;
  const a = (angleDeg * Math.PI) / 180, sp = speedFor(power);
  let x: number = LAUNCHER.x, y: number = LAUNCHER.y;
  let vx = Math.cos(a) * sp, vy = -Math.sin(a) * sp;
  const path: Vec[] = [[x, y]];
  const hits: Hit[] = [];
  const recordHits = recordEvery !== Infinity;
  // Which pieces the ball has touched. A win needs at least one.
  const touched = new Array<boolean>(world.placedCount).fill(false);
  let touchedCount = 0;
  let slow = 0, inside = 0, t = 0, step = 0;
  const segs = world.segs;
  const finish = (success: boolean, end: EndReason): SimResult => { path.push([x, y]); return { path, success, t, end, hits }; };
  const settled = () => touchedCount > 0 ? finish(true, 'glass') : finish(false, 'skipped');

  while (t < MAX_SIM_SECONDS) {
    vy += GRAVITY * DT;
    x += vx * DT;
    y += vy * DT;

    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const ex = s.x2 - s.x1, ey = s.y2 - s.y1;
      const L2 = ex * ex + ey * ey;
      let u = L2 ? ((x - s.x1) * ex + (y - s.y1) * ey) / L2 : 0;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const qx = s.x1 + ex * u, qy = s.y1 + ey * u;
      let dx = x - qx, dy = y - qy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= R * R) continue;

      if (s.kind === 'dead') {
        t += DT;
        return inGlass(world, x, y) ? settled() : finish(false, 'dead');
      }
      if (s.piece !== undefined && !touched[s.piece]) { touched[s.piece] = true; touchedCount++; }

      let d = Math.sqrt(d2);
      if (d < 1e-6) { dx = -ey; dy = ex; d = Math.hypot(dx, dy) || 1; }
      const nx = dx / d, ny = dy / d;
      x += nx * (R - d);
      y += ny * (R - d);
      const vn = vx * nx + vy * ny;
      if (vn < 0) {
        const e = -vn < RESTING_CONTACT_SPEED ? 0 : s.e;
        if (e && recordHits) hits.push({ i: path.length, kind: s.kind as Hit['kind'], speed: -vn, piece: s.piece });
        vx -= (1 + e) * vn * nx;
        vy -= (1 + e) * vn * ny;
        const vt = vx * -ny + vy * nx;
        vx -= vt * s.f * -ny;
        vy -= vt * s.f * nx;
      }
    }

    t += DT;
    step++;
    if (step % recordEvery === 0) path.push([x, y]);

    if (offBoard(x, y)) return finish(false, 'out');

    if (inGlass(world, x, y)) {
      inside += DT;
      if (inside > SETTLE_IN_GLASS_S) return settled();
    } else inside = 0;

    if (Math.hypot(vx, vy) < REST_SPEED) { slow += DT; if (slow > REST_TIME_S) return finish(false, 'rest'); }
    else slow = 0;
  }
  return finish(false, 'timeout');
}

/** Every angle/power value the UI can produce (0.1 steps), as exact numbers the UI would pass. */
export function inputGrid(min: number, max: number, step: number): number[] {
  const n = Math.round((max - min) / step), out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(+(min + i * step).toFixed(1));
  return out;
}
