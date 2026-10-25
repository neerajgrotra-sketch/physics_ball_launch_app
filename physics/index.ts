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
 * - A win uses every bar: all of the level's bars must be on the board, and the ball must touch each one
 *   before it settles in the glass. Landing any other way doesn't count, so no level can be won with
 *   fewer bars (or none), by rule.
 * - Bounces are the score: every real bounce (off a bar, a wall, the floor or the outside of the glass)
 *   counts, except while the ball is down inside the glass, so rattling around in it doesn't. Each level's
 *   par is the fewest bounces its solver found (Level.par).
 */

// Board shape: 400 x 560 so it fills a phone's width once the controls are on screen.
export const WORLD = { width: 400, height: 560, ground: 540 } as const;
export const LAUNCHER = { x: 44, y: 512 } as const; // 28 above the floor
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
/** Bounciness of a spring pad: more than 1, so the ball leaves faster than it arrived. */
export const PAD_RESTITUTION = 1.3;
/** Extra speed (px/s) a spring pad adds along its normal on top of the restitution: a small kick, so even a ball dropped gently is thrown. */
export const PAD_KICK = 240;
/** No bounce may send the ball faster than a full-power launch, so it can't tunnel through a thin surface. */
export const MAX_BALL_SPEED = 1120;
/** The glass stands on a plate this much wider than the glass on each side. */
export const PLATE_OVERHANG = 8;
export const ANGLE_STEP = 0.1;       // the only angle values a player can enter
export const POWER_STEP = 0.1;       // the only power values a player can enter

export type Vec = [number, number];
/** Fixed (dead) obstacle: [x1, y1, x2, y2] */
export type FixedSegment = [number, number, number, number];

/**
 * A fixed solid block the ball bounces off (as softly as the walls): a rectangle `w` × `h` centred on (x, y),
 * turned `deg` degrees (default 0). Unlike a dead obstacle, touching one doesn't end the shot.
 */
export interface Block { x: number; y: number; w: number; h: number; deg?: number }

/** The four corners of a block, in order round it. */
export function blockCorners(b: Block): [number, number][] {
  const a = ((b.deg ?? 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), hw = b.w / 2, hh = b.h / 2;
  return ([[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]] as [number, number][]).map(([dx, dy]) => [b.x + dx * c - dy * s, b.y + dx * s + dy * c]);
}

/** How far a hazard's spikes stick out of its body; the ball is destroyed when it touches a spike tip. */
export const SPIKE_LENGTH = 8;

/** The outline the ball dies on: the hazard's body grown by its spikes. */
export function hazardReach(b: Block): Block {
  return { ...b, w: b.w + 2 * SPIKE_LENGTH, h: b.h + 2 * SPIKE_LENGTH };
}

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
  /** Fixed bouncy blocks (see Block). Optional: most levels have none. */
  blocks?: Block[];
  /**
   * Spiked hazards (same shape as a Block, drawn red with spikes all round). Touching one destroys the ball:
   * the shot ends there ('dead') and counts as a try. Optional.
   */
  hazards?: Block[];
  /**
   * Spring pads (same shape as a Block): a surface that throws the ball back harder than it came (PAD_RESTITUTION and
   * PAD_KICK, capped at MAX_BALL_SPEED), drawn as an energised plate. Optional.
   */
  pads?: Block[];
  /**
   * Analysis only (tools/needs-walls.ts): make the floor and all four board edges deadly instead of bouncy, to test
   * whether a level can be won without bouncing off the board's own walls. Never set on a shipped level.
   */
  edgesDead?: boolean;
  pieces: PieceSpec[];
  /** One verified answer, shown by the Solve button. pieces[i] matches level.pieces[i]. */
  solution?: Solution;
  /** Fewest bounces the solver found for a win (the stored solution takes exactly this many). */
  par?: number;
}

export type SegmentKind = 'dead' | 'glass' | 'piece' | 'wall' | 'block' | 'pad';
/** `piece` is the index of the placed piece a 'piece' segment belongs to. */
export interface Segment { x1: number; y1: number; x2: number; y2: number; e: number; f: number; kind: SegmentKind; piece?: number }
export interface World {
  segs: Segment[];
  glass: { l: number; r: number; rim: number; base: number };
  /** How many pieces the level gives, and how many are placed. A win needs them all placed and touched. */
  pieceCount: number;
  placedCount: number;
}
/**
 * How a shot ended. 'glass': settled in the glass after touching every bar (a win). 'skipped': settled
 * in the glass, but not every bar was placed and touched (`touched` says which were). 'dead': hit a grey obstacle. 'rest': stopped somewhere else.
 * 'out': left the board, which the edges should make impossible (kept as a safety net).
 */
export type EndReason = 'glass' | 'skipped' | 'out' | 'dead' | 'rest' | 'timeout';
/**
 * A real bounce (not resting contact) off a piece, the glass or a wall. `i` is the index of the next path
 * point. `counts`: it's one of the shot's scored bounces (any real bounce outside the glass).
 */
export interface Hit { i: number; kind: 'piece' | 'glass' | 'wall' | 'block' | 'pad'; speed: number; piece?: number; counts: boolean }
/**
 * `touched[k]`: whether the ball touched placed piece k during the shot. `bounces`: the scored bounce
 * count (see the rules above), at most one per step so a corner hit is one bounce.
 */
export interface SimResult { path: Vec[]; success: boolean; t: number; end: EndReason; hits: Hit[]; touched: boolean[]; bounces: number }

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
  const wall = (x1: number, y1: number, x2: number, y2: number) =>
    level.edgesDead ? add(x1, y1, x2, y2, 0, 0, 'dead') : add(x1, y1, x2, y2, WALL_RESTITUTION, WALL_FRICTION, 'wall');
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
  // Hazards are dead all the way out to their spike tips.
  for (const h of level.hazards ?? []) {
    const k = blockCorners(hazardReach(h));
    k.forEach((p, i) => { const q = k[(i + 1) % 4]; add(p[0], p[1], q[0], q[1], 0, 0, 'dead'); });
  }
  // Blocks bounce like the walls do (a stray ball loses energy and settles), one edge at a time.
  for (const b of level.blocks ?? []) {
    const k = blockCorners(b);
    k.forEach((p, i) => { const q = k[(i + 1) % 4]; add(p[0], p[1], q[0], q[1], WALL_RESTITUTION, WALL_FRICTION, 'block'); });
  }
  // Spring pads: their own kind, so the bounce can kick.
  for (const b of level.pads ?? []) {
    const k = blockCorners(b);
    k.forEach((p, i) => { const q = k[(i + 1) % 4]; add(p[0], p[1], q[0], q[1], PAD_RESTITUTION, 0.01, 'pad'); });
  }
  placed.forEach((p, k) => {
    const [x1, y1, x2, y2] = pieceEnds(p);
    add(x1, y1, x2, y2, p.restitution ?? 0.85, 0.01, 'piece', k);
  });
  return { segs, glass: { l, r, rim, base }, pieceCount: level.pieces.length, placedCount: placed.length };
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
  // Which pieces the ball has touched. A win needs every one of the level's pieces placed and touched.
  const touched = new Array<boolean>(world.placedCount).fill(false);
  let touchedCount = 0;
  let slow = 0, inside = 0, t = 0, step = 0;
  let bounces = 0;
  const cup = world.glass; // bounces down inside the glass (below its rim) don't count
  const segs = world.segs;
  const finish = (success: boolean, end: EndReason): SimResult => { path.push([x, y]); return { path, success, t, end, hits, touched, bounces }; };
  const everyBar = () => world.placedCount === world.pieceCount && touchedCount === world.pieceCount;
  const settled = () => everyBar() ? finish(true, 'glass') : finish(false, 'skipped');

  while (t < MAX_SIM_SECONDS) {
    vy += GRAVITY * DT;
    x += vx * DT;
    y += vy * DT;
    let bouncedThisStep = false;

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
        const pad = s.kind === 'pad';
        const e = !pad && -vn < RESTING_CONTACT_SPEED ? 0 : s.e;
        const counts = e > 0 && !bouncedThisStep && !(x > cup.l && x < cup.r && y > cup.rim);
        if (counts) { bounces++; bouncedThisStep = true; }
        if (e && recordHits) hits.push({ i: path.length, kind: s.kind as Hit['kind'], speed: -vn, piece: s.piece, counts });
        if (pad) {
          // Out along the normal at e × the arrival speed plus the kick, and never above the speed cap.
          const out = Math.min(-vn * e + PAD_KICK, MAX_BALL_SPEED);
          vx += (out - vn) * nx;
          vy += (out - vn) * ny;
          const sp2 = Math.hypot(vx, vy);
          if (sp2 > MAX_BALL_SPEED) { vx *= MAX_BALL_SPEED / sp2; vy *= MAX_BALL_SPEED / sp2; }
        } else {
          vx -= (1 + e) * vn * nx;
          vy -= (1 + e) * vn * ny;
        }
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
