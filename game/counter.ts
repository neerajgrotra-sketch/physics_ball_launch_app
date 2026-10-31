import { WORLD, LAUNCHER, PORTAL_RADIUS, blockCorners, glassBox, hazardReach, PLATE_OVERHANG, type Level } from '../physics';

// The live bounce counter sits over the top of the board. Where a level has something up there (a spiked roof, a block, a
// portal, the glass), it would cover part of the puzzle, so it takes whichever of the top-left, top-centre or top-right corner
// covers the least. Pure: no UI imports.

export type CounterSpot = 'left' | 'center' | 'right';

/** The bounce counter's size in board units (about 118 × 50 px on a phone), and the gap from the board's edge. The tries badge takes
 * the opposite top corner. */
const W = 140, H = 62, MARGIN = 10;

type Box = [number, number, number, number]; // x1, y1, x2, y2

const boxOfBlock = (b: Parameters<typeof blockCorners>[0]): Box => {
  const k = blockCorners(b);
  return [Math.min(...k.map((p) => p[0])), Math.min(...k.map((p) => p[1])), Math.max(...k.map((p) => p[0])), Math.max(...k.map((p) => p[1]))];
};

/** Everything on the board that the counter shouldn't cover, as boxes in board units. */
export function boardBoxes(level: Level): Box[] {
  const g = glassBox(level.glass);
  const boxes: Box[] = [
    ...(level.blocks ?? []).map(boxOfBlock),
    ...(level.hazards ?? []).map((h) => boxOfBlock(hazardReach(h))),
    ...(level.pads ?? []).map(boxOfBlock),
    [g.l - PLATE_OVERHANG, g.rim, g.r + PLATE_OVERHANG, g.base],
    [LAUNCHER.x - 20, LAUNCHER.y - 30, LAUNCHER.x + 20, WORLD.ground],
  ];
  for (const p of level.portals ?? []) for (const q of [p.a, p.b]) {
    const r = PORTAL_RADIUS + 6;
    boxes.push([q.x - r, q.y - r, q.x + r, q.y + r]);
  }
  for (const f of level.fixed) boxes.push([Math.min(f[0], f[2]) - 4, Math.min(f[1], f[3]) - 4, Math.max(f[0], f[2]) + 4, Math.max(f[1], f[3]) + 4]);
  return boxes;
}

const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));

/** The corner for the bounce counter: the usual top-left unless another covers strictly less of the level. */
export function counterSpot(level: Level): CounterSpot {
  const boxes = boardBoxes(level);
  const spots: [CounterSpot, Box][] = [
    ['left', [MARGIN, MARGIN, MARGIN + W, MARGIN + H]],
    ['right', [WORLD.width - MARGIN - W, MARGIN, WORLD.width - MARGIN, MARGIN + H]],
    ['center', [(WORLD.width - W) / 2, MARGIN, (WORLD.width + W) / 2, MARGIN + H]],
  ];
  let best = spots[0], bestCover = Infinity;
  for (const s of spots) {
    const cover = boxes.reduce((sum, b) => sum + overlap(s[1], b), 0);
    if (cover < bestCover) { best = s; bestCover = cover; }
  }
  return best[0];
}

/** The board box a badge takes in a top corner (the bounce counter's own spot, or the tries badge's opposite one). */
export function badgeBox(spot: CounterSpot): Box {
  if (spot === 'left') return [MARGIN, MARGIN, MARGIN + W, MARGIN + H];
  if (spot === 'right') return [WORLD.width - MARGIN - W, MARGIN, WORLD.width - MARGIN, MARGIN + H];
  return [(WORLD.width - W) / 2, MARGIN, (WORLD.width + W) / 2, MARGIN + H];
}

/**
 * Whether anything the player is working with sits under a badge: a placed bar (checked along its length, with a bar's half-width
 * of margin) or a bounce marker. Then the badge collapses to a small chip so it doesn't hide them.
 */
export function badgeCovers(box: Box, bars: { x1: number; y1: number; x2: number; y2: number }[], marks: { x: number; y: number }[]): boolean {
  const PAD = 8;
  const inside = (x: number, y: number) => x >= box[0] - PAD && x <= box[2] + PAD && y >= box[1] - PAD && y <= box[3] + PAD;
  if (marks.some((m) => inside(m.x, m.y))) return true;
  return bars.some((b) => {
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      if (inside(b.x1 + (b.x2 - b.x1) * t, b.y1 + (b.y2 - b.y1) * t)) return true;
    }
    return false;
  });
}
