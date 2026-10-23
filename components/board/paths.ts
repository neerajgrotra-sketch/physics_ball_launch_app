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

/** Rotate-handle arc on the selected piece's end, as in the prototype (radius 5, -2.2 to 1.4 rad). */
export function handleArcPath(x: number, y: number): SkPath {
  const p = Skia.PathBuilder.Make();
  const start = (-2.2 * 180) / Math.PI, sweep = ((1.4 + 2.2) * 180) / Math.PI;
  p.addArc({ x: x - 5, y: y - 5, width: 10, height: 10 }, start, sweep);
  return p.detach();
}
