/**
 * Bank Shot physics: pure, deterministic, UI-free.
 * Rules: no imports from React/Expo/Skia, no Math.random, no Date/performance.
 * Same (level, pieces, angle, power) must always produce the identical path.
 *
 * Core rule of the game: ONLY the player's pieces and the glass bounce.
 * The ground, the world edges and every fixed obstacle are "dead": touching one ends the shot.
 * A launched ball always moves rightward until it hits a piece, so a glass whose mouth can only be
 * entered from the right (see `hood` levels) is impossible to reach without pieces.
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
export const ANGLE_STEP = 0.1;       // the only angle values a player can enter
export const POWER_STEP = 0.1;       // the only power values a player can enter

export type Vec = [number, number];
/** Fixed (dead) obstacle: [x1, y1, x2, y2] */
export type FixedSegment = [number, number, number, number];

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

export type SegmentKind = 'dead' | 'glass' | 'piece';
export interface Segment { x1: number; y1: number; x2: number; y2: number; e: number; f: number; kind: SegmentKind }
export interface World {
  segs: Segment[];
  glass: { l: number; r: number; rim: number; base: number };
}
export type EndReason = 'glass' | 'dead' | 'rest' | 'timeout';
export interface SimResult { path: Vec[]; success: boolean; t: number; end: EndReason }

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
  const { width: W, ground: GROUND } = WORLD;
  const segs: Segment[] = [];
  const add = (x1: number, y1: number, x2: number, y2: number, e: number, f: number, kind: SegmentKind) =>
    segs.push({ x1, y1, x2, y2, e, f, kind });
  const dead = (x1: number, y1: number, x2: number, y2: number) => add(x1, y1, x2, y2, 0, 0, 'dead');

  const { l, r, rim, base } = glassBox(level.glass);
  // Ground is dead, except under a glass that stands on it (the glass has its own floor).
  if (base === GROUND) { dead(0, GROUND, l, GROUND); dead(r, GROUND, W, GROUND); }
  else dead(0, GROUND, W, GROUND);
  dead(0, 0, 0, GROUND);
  dead(W, 0, W, GROUND);
  dead(0, 0, W, 0);

  add(l, rim, l, base, 0.35, 0.02, 'glass');
  add(r, rim, r, base, 0.35, 0.02, 'glass');
  add(l, base, r, base, 0.3, 0.05, 'glass');

  for (const s of level.fixed) dead(s[0], s[1], s[2], s[3]);
  for (const p of placed) {
    const [x1, y1, x2, y2] = pieceEnds(p);
    add(x1, y1, x2, y2, p.restitution ?? 0.85, 0.01, 'piece');
  }
  return { segs, glass: { l, r, rim, base } };
}

export function inGlass(world: World, x: number, y: number): boolean {
  const g = world.glass;
  return x > g.l && x < g.r && y > g.rim + BALL_RADIUS * 0.5 && y < g.base;
}

/**
 * Simulate one launch.
 * @param recordEvery record a path point every N steps (2 → 120 points/s, matches playback).
 *                    Pass Infinity in the solver to skip path building.
 */
export function simulate(world: World, angleDeg: number, power: number, recordEvery = 2): SimResult {
  const R = BALL_RADIUS;
  const a = (angleDeg * Math.PI) / 180, sp = speedFor(power);
  let x: number = LAUNCHER.x, y: number = LAUNCHER.y;
  let vx = Math.cos(a) * sp, vy = -Math.sin(a) * sp;
  const path: Vec[] = [[x, y]];
  let slow = 0, inside = 0, t = 0, step = 0;
  const segs = world.segs;
  const finish = (success: boolean, end: EndReason): SimResult => { path.push([x, y]); return { path, success, t, end }; };

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
        return inGlass(world, x, y) ? finish(true, 'glass') : finish(false, 'dead');
      }

      let d = Math.sqrt(d2);
      if (d < 1e-6) { dx = -ey; dy = ex; d = Math.hypot(dx, dy) || 1; }
      const nx = dx / d, ny = dy / d;
      x += nx * (R - d);
      y += ny * (R - d);
      const vn = vx * nx + vy * ny;
      if (vn < 0) {
        const e = -vn < RESTING_CONTACT_SPEED ? 0 : s.e;
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

    if (inGlass(world, x, y)) {
      inside += DT;
      if (inside > SETTLE_IN_GLASS_S) return finish(true, 'glass');
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
