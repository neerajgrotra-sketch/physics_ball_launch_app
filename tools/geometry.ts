import { buildWorld, pieceEnds, WORLD, LAUNCHER, BALL_RADIUS, type Level, type PlacedPiece } from '../physics';

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

/** A placement is legal if every piece is inside the board, clear of all other geometry and the launcher. */
export function legalPlacement(level: Level, placed: PlacedPiece[]): boolean {
  const world = buildWorld(level, []);
  const ends = placed.map(pieceEnds);
  for (const e of ends) {
    if (Math.min(e[0], e[2]) < 12 || Math.max(e[0], e[2]) > WORLD.width - 12) return false;
    if (Math.min(e[1], e[3]) < 12 || Math.max(e[1], e[3]) > WORLD.ground - 12) return false;
    if (segDist(e, [LAUNCHER.x, LAUNCHER.y - 40, LAUNCHER.x, WORLD.ground]) < 30) return false;
    for (const s of world.segs) if (segDist(e, [s.x1, s.y1, s.x2, s.y2]) < BALL_RADIUS * 2 + 2) return false;
  }
  for (let i = 0; i < ends.length; i++) for (let j = i + 1; j < ends.length; j++)
    if (segDist(ends[i], ends[j]) < BALL_RADIUS * 2 + 2) return false;
  return true;
}
