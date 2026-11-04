import { blockCorners, buildWorld, glassBox, hazardReach, pieceEnds, PLATE_OVERHANG, WORLD, LAUNCHER, BALL_RADIUS, PORTAL_RADIUS, type Level, type PlacedPiece } from '../physics';

// Where a bar may go. One rule for the player and the level generator, so every stored solution can be
// placed by hand, and nothing the player places can do what a solution couldn't. Pure: no UI imports.

/** Gap a bar must keep from the glass, the walls and other bars: a ball's width, plus a little. */
export const CLEARANCE = BALL_RADIUS * 2 + 2;
/** Gap a bar must keep from the launcher post. */
const LAUNCHER_CLEARANCE = 30;
const MARGIN = 12;

/** Shortest distance between two segments [x1, y1, x2, y2] (0 if they cross). */
export function segDist(a: number[], b: number[]): number {
  const [x1, y1, x2, y2] = a, [x3, y3, x4, y4] = b;
  const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;
  const d1 = cross(x2 - x1, y2 - y1, x3 - x1, y3 - y1), d2 = cross(x2 - x1, y2 - y1, x4 - x1, y4 - y1);
  const d3 = cross(x4 - x3, y4 - y3, x1 - x3, y1 - y3), d4 = cross(x4 - x3, y4 - y3, x2 - x3, y2 - y3);
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0;
  const pd = (px: number, py: number, s: number[]) => {
    const ex = s[2] - s[0], ey = s[3] - s[1], L2 = ex * ex + ey * ey;
    let u = L2 ? ((px - s[0]) * ex + (py - s[1]) * ey) / L2 : 0; u = Math.max(0, Math.min(1, u));
    return Math.hypot(px - s[0] - ex * u, py - s[1] - ey * u);
  };
  return Math.min(pd(x1, y1, b), pd(x2, y2, b), pd(x3, y3, a), pd(x4, y4, a));
}

/**
 * For each placed piece, whether it breaks the rule: it must stay on the board and keep CLEARANCE from
 * the glass (walls and plate), the board edges and floor, any fixed obstacle and every other piece, and
 * keep clear of the launcher. Two pieces too close to each other are both marked.
 */
export function illegalPieces(level: Level, placed: PlacedPiece[]): boolean[] {
  const world = buildWorld(level, []);
  const ends = placed.map(pieceEnds);
  const bad = ends.map((e) => {
    if (Math.min(e[0], e[2]) < MARGIN || Math.max(e[0], e[2]) > WORLD.width - MARGIN) return true;
    if (Math.min(e[1], e[3]) < MARGIN || Math.max(e[1], e[3]) > WORLD.ground - MARGIN) return true;
    if (segDist(e, [LAUNCHER.x, LAUNCHER.y - 40, LAUNCHER.x, WORLD.ground]) < LAUNCHER_CLEARANCE) return true;
    if ((level.portals ?? []).some((pr) => [pr.a, pr.b].some((q) => segDist(e, [q.x, q.y, q.x, q.y]) < PORTAL_RADIUS + CLEARANCE))) return true;
    return world.segs.some((s) => segDist(e, [s.x1, s.y1, s.x2, s.y2]) < CLEARANCE);
  });
  for (let i = 0; i < ends.length; i++) for (let j = i + 1; j < ends.length; j++)
    if (segDist(ends[i], ends[j]) < CLEARANCE) bad[i] = bad[j] = true;
  return bad;
}

/** A placement is legal if no piece breaks the rule (see illegalPieces). */
export function legalPlacement(level: Level, placed: PlacedPiece[]): boolean {
  return !illegalPieces(level, placed).some(Boolean);
}

/** What a bar is too close to (see illegalPieces): named so the game can say what's in the way. */
export type Blocker =
  | { what: 'edge' | 'floor' | 'cannon' | 'portal' | 'glass' | 'block' | 'spikes' | 'pad' | 'wall' }
  | { what: 'bar'; other: number };
export interface Blockage { blocker: Blocker; /** about where the bar meets it, to mark on the board */ at: [number, number] }

/** The point on segment s nearest to segment e (where e would meet it), and roughly that spot on e. */
function meetPoint(e: number[], s: number[]): [number, number] {
  let best: [number, number] = [(e[0] + e[2]) / 2, (e[1] + e[3]) / 2], bestD = Infinity;
  for (let k = 0; k <= 24; k++) {
    const u = k / 24, px = e[0] + (e[2] - e[0]) * u, py = e[1] + (e[3] - e[1]) * u;
    const d = segDist([px, py, px, py], s);
    if (d < bestD) { bestD = d; best = [px, py]; }
  }
  return best;
}

/**
 * Why placed piece k breaks the rule, if it does: the first thing it's too close to, in the same order illegalPieces checks
 * (board edges and floor, the cannon, portals, the glass, blocks, spikes, spring pads, fixed walls, then the other pieces), with
 * about where it touches. Null when piece k is allowed where it is.
 */
export function blockage(level: Level, placed: PlacedPiece[], k: number): Blockage | null {
  const e = pieceEnds(placed[k]);
  const mid: [number, number] = [(e[0] + e[2]) / 2, (e[1] + e[3]) / 2];
  const lowEnd: [number, number] = e[1] > e[3] ? [e[0], e[1]] : [e[2], e[3]];
  if (Math.max(e[1], e[3]) > WORLD.ground - MARGIN) return { blocker: { what: 'floor' }, at: lowEnd };
  if (Math.min(e[0], e[2]) < MARGIN || Math.max(e[0], e[2]) > WORLD.width - MARGIN || Math.min(e[1], e[3]) < MARGIN) {
    const out = [[e[0], e[1]], [e[2], e[3]]].sort((a, b) => edgeGap(a) - edgeGap(b))[0] as [number, number];
    return { blocker: { what: 'edge' }, at: out };
  }
  const post = [LAUNCHER.x, LAUNCHER.y - 40, LAUNCHER.x, WORLD.ground];
  if (segDist(e, post) < LAUNCHER_CLEARANCE) return { blocker: { what: 'cannon' }, at: meetPoint(e, post) };
  for (const pr of level.portals ?? []) for (const q of [pr.a, pr.b]) {
    const pt = [q.x, q.y, q.x, q.y];
    if (segDist(e, pt) < PORTAL_RADIUS + CLEARANCE) return { blocker: { what: 'portal' }, at: meetPoint(e, pt) };
  }
  const near = (segs: number[][], what: Blocker['what']): Blockage | null => {
    for (const s of segs) if (segDist(e, s) < CLEARANCE) return { blocker: { what } as Blocker, at: meetPoint(e, s) };
    return null;
  };
  const edges = (corners: [number, number][]) => corners.map((p, i) => { const q = corners[(i + 1) % 4]; return [p[0], p[1], q[0], q[1]]; });
  const { l, r, rim, base } = glassBox(level.glass);
  const found =
    near([[l, rim, l, base], [r, rim, r, base], [l - PLATE_OVERHANG, base, r + PLATE_OVERHANG, base]], 'glass') ??
    near((level.blocks ?? []).flatMap((b) => edges(blockCorners(b))), 'block') ??
    near((level.hazards ?? []).flatMap((h) => edges(blockCorners(hazardReach(h)))), 'spikes') ??
    near((level.pads ?? []).flatMap((b) => edges(blockCorners(b))), 'pad') ??
    near(level.fixed.map((f) => [...f]), 'wall');
  if (found) return found;
  // Anything else the world has (the glass plate's exact overhang, the board's own walls) counts as the glass or an edge.
  for (const s of buildWorld(level, []).segs) {
    const seg = [s.x1, s.y1, s.x2, s.y2];
    if (segDist(e, seg) < CLEARANCE) return { blocker: { what: s.kind === 'glass' ? 'glass' : s.kind === 'wall' && s.y1 === WORLD.ground && s.y2 === WORLD.ground ? 'floor' : 'edge' }, at: meetPoint(e, seg) };
  }
  for (let j = 0; j < placed.length; j++) {
    if (j === k) continue;
    const o = pieceEnds(placed[j]);
    if (segDist(e, o) < CLEARANCE) return { blocker: { what: 'bar', other: j }, at: meetPoint(e, o) };
  }
  return illegalPieces(level, placed)[k] ? { blocker: { what: 'edge' }, at: mid } : null;
}

const edgeGap = ([x, y]: number[]) => Math.min(x, WORLD.width - x, y);
