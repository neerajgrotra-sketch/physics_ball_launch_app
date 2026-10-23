import { buildWorld, pieceEnds, WORLD, LAUNCHER, BALL_RADIUS, type Level, type PlacedPiece } from '../physics';

// Where a bar may go. One rule for the player and the level generator, so every stored solution can be
// placed by hand, and nothing the player places can do what a solution couldn't. Pure: no UI imports.

/** Gap a bar must keep from the glass, the walls and other bars: a ball's width, plus a little. */
export const CLEARANCE = BALL_RADIUS * 2 + 2;
/** Gap a bar must keep from the launcher post. */
const LAUNCHER_CLEARANCE = 30;
const MARGIN = 12;

/** Shortest distance between two segments [x1, y1, x2, y2] (0 if they cross). */
function segDist(a: number[], b: number[]): number {
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
