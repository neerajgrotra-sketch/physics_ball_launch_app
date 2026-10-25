import { Skia, type SkPath } from '@shopify/react-native-skia';
import { WORLD, type FixedSegment, type Vec } from '../../physics';

// Path builders for the board, in world units. They mirror the drawing code in reference/prototype.html.
// Skia paths are immutable: each is built with a PathBuilder, then detached.

const { width: W, height: H, ground: GROUND } = WORLD;

/** Graph paper over the whole board: fine lines every 20 units, heavier every 100. */
export function gridPaths(): { fine: SkPath; major: SkPath } {
  const fine = Skia.PathBuilder.Make();
  for (let x = 20; x < W; x += 20) { fine.moveTo(x, 0); fine.lineTo(x, H); }
  for (let y = 20; y < H; y += 20) { fine.moveTo(0, y); fine.lineTo(W, y); }
  const major = Skia.PathBuilder.Make();
  for (let x = 100; x < W; x += 100) { major.moveTo(x, 0); major.lineTo(x, H); }
  for (let y = 100; y < H; y += 100) { major.moveTo(0, y); major.lineTo(W, y); }
  return { fine: fine.detach(), major: major.detach() };
}

export function linePath(x1: number, y1: number, x2: number, y2: number): SkPath {
  const p = Skia.PathBuilder.Make();
  p.moveTo(x1, y1);
  p.lineTo(x2, y2);
  return p.detach();
}

/** Fixed obstacles: the thick bars plus the paper-coloured hatching drawn over them. */
export function deadPaths(fixed: FixedSegment[]): { bars: SkPath; hatch: SkPath } {
  const bars = Skia.PathBuilder.Make();
  const hatch = Skia.PathBuilder.Make();
  for (const [x1, y1, x2, y2] of fixed) {
    bars.moveTo(x1, y1);
    bars.lineTo(x2, y2);
    const L = Math.hypot(x2 - x1, y2 - y1);
    if (!L) continue;
    const ux = (x2 - x1) / L, uy = (y2 - y1) / L;
    for (let d = 4; d < L - 2; d += 6) {
      const cx = x1 + ux * d, cy = y1 + uy * d;
      hatch.moveTo(cx - 2.5 * uy - 2 * ux, cy + 2.5 * ux - 2 * uy);
      hatch.lineTo(cx + 2.5 * uy + 2 * ux, cy - 2.5 * ux + 2 * uy);
    }
  }
  return { bars: bars.detach(), hatch: hatch.detach() };
}

/** Fixed bouncy blocks: one closed outline each (fill and stroke it). */
export function blockPath(corners: [number, number][]): SkPath {
  const p = Skia.PathBuilder.Make();
  corners.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.close();
  return p.detach();
}

/**
 * A spiked hazard: its body outline, and a row of triangular spikes along every edge pointing outwards
 * (`length` long, a spike about every 12 units). `corners` go clockwise on screen, as blockCorners returns them.
 */
export function hazardPaths(corners: [number, number][], length: number): { body: SkPath; spikes: SkPath } {
  const body = Skia.PathBuilder.Make(), spikes = Skia.PathBuilder.Make();
  corners.forEach(([x, y], i) => (i ? body.lineTo(x, y) : body.moveTo(x, y)));
  body.close();
  corners.forEach(([x1, y1], i) => {
    const [x2, y2] = corners[(i + 1) % corners.length];
    const L = Math.hypot(x2 - x1, y2 - y1);
    if (L < 6) return;
    const ux = (x2 - x1) / L, uy = (y2 - y1) / L, nx = uy, ny = -ux; // along, and outwards
    const count = Math.max(1, Math.floor(L / 12)), gap = L / count;
    for (let k = 0; k < count; k++) {
      const mid = (k + 0.5) * gap, half = Math.min(5.5, gap / 2 - 0.5);
      spikes.moveTo(x1 + ux * (mid - half), y1 + uy * (mid - half));
      spikes.lineTo(x1 + ux * mid + nx * length, y1 + uy * mid + ny * length);
      spikes.lineTo(x1 + ux * (mid + half), y1 + uy * (mid + half));
      spikes.close();
    }
  });
  return { body: body.detach(), spikes: spikes.detach() };
}

/** Polyline through the first `n` points of a path. */
export function polyPath(path: Vec[], n = path.length): SkPath {
  const p = Skia.PathBuilder.Make();
  if (n < 2) return p.detach();
  p.moveTo(path[0][0], path[0][1]);
  for (let i = 1; i < n; i++) p.lineTo(path[i][0], path[i][1]);
  return p.detach();
}

/** Small × marking where a shot hit a dead surface. */
export function crossPath(x: number, y: number): SkPath {
  const p = Skia.PathBuilder.Make();
  p.moveTo(x - 5, y - 5); p.lineTo(x + 5, y + 5);
  p.moveTo(x + 5, y - 5); p.lineTo(x - 5, y + 5);
  return p.detach();
}

/** Launcher base: a trapezoid from the ground up to the launch point. */
export function launcherPath(lx: number, ly: number): SkPath {
  const p = Skia.PathBuilder.Make();
  p.moveTo(lx - 14, GROUND);
  p.lineTo(lx + 14, GROUND);
  p.lineTo(lx + 4, ly);
  p.lineTo(lx - 4, ly);
  p.close();
  return p.detach();
}

/** Two-way arrow for a move grip at (x, y): arrowheads left and right, or up and down. */
export function moveIconPath(x: number, y: number, horizontal: boolean): SkPath {
  const p = Skia.PathBuilder.Make();
  const [ux, uy] = horizontal ? [1, 0] : [0, 1], [vx, vy] = [-uy, ux];
  const pt = (a: number, b: number): [number, number] => [x + ux * a + vx * b, y + uy * a + vy * b];
  const line = (a: [number, number], b: [number, number]) => { p.moveTo(a[0], a[1]); p.lineTo(b[0], b[1]); };
  line(pt(-5.5, 0), pt(5.5, 0));
  for (const s of [-1, 1]) { line(pt(s * 5.5, 0), pt(s * 2.5, 2.6)); line(pt(s * 5.5, 0), pt(s * 2.5, -2.6)); }
  return p.detach();
}

/** Rotate-handle arc on the selected piece's end, as in the prototype (radius 5, -2.2 to 1.4 rad). */
export function handleArcPath(x: number, y: number): SkPath {
  const p = Skia.PathBuilder.Make();
  const start = (-2.2 * 180) / Math.PI, sweep = ((1.4 + 2.2) * 180) / Math.PI;
  p.addArc({ x: x - 5, y: y - 5, width: 10, height: 10 }, start, sweep);
  return p.detach();
}
