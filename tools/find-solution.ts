import { buildWorld, simulate, type Level, type PlacedPiece, type Solution } from '../physics';
import { legalPlacement } from './geometry';

function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

/**
 * Random search for a robust solution: pieces placed at whole-unit positions and whole degrees,
 * angle/power on the 0.1 grid. Robustness = how many of the 7×7 neighbouring inputs also land.
 */
export function findSolution(level: Level, opts: { samples?: number; seed?: number; maxPieces?: number } = {}): (Solution & { robustness: number }) | null {
  const { samples = 400_000, seed = 1, maxPieces = level.pieces.length } = opts;
  const r = rng(seed);
  const hits: { placed: PlacedPiece[]; angle: number; power: number }[] = [];
  for (let k = 1; k <= maxPieces && hits.length === 0; k++) {
    let tries = 0, placed: PlacedPiece[] = [], world = buildWorld(level, []);
    for (let n = 0; n < samples; n++) {
      if (tries-- <= 0) {
        do {
          placed = level.pieces.slice(0, k).map(p => ({
            len: p.len, restitution: p.restitution,
            x: Math.round(20 + r() * 360), y: Math.round(20 + r() * 660), deg: Math.floor(r() * 180),
          }));
        } while (!legalPlacement(level, placed));
        world = buildWorld(level, placed); tries = 200;
      }
      const angle = +(5 + r() * 85).toFixed(1), power = +(r() * 100).toFixed(1);
      if (simulate(world, angle, power, Infinity).success) { hits.push({ placed, angle, power }); tries = 0; }
    }
  }
  let best: (Solution & { robustness: number }) | null = null;
  for (const h of hits) {
    const world = buildWorld(level, h.placed);
    let bestHere = { angle: h.angle, power: h.power, score: -1 };
    for (let da = -6; da <= 6; da++) for (let dp = -6; dp <= 6; dp++) {
      const angle = +(h.angle + da * 0.1).toFixed(1), power = +(h.power + dp * 0.1).toFixed(1);
      if (angle < 0 || angle > 90 || power < 0 || power > 100) continue;
      if (!simulate(world, angle, power, Infinity).success) continue;
      let score = 0;
      for (let ea = -3; ea <= 3; ea++) for (let ep = -3; ep <= 3; ep++)
        if (simulate(world, +(angle + ea * 0.1).toFixed(1), +(power + ep * 0.1).toFixed(1), Infinity).success) score++;
      if (score > bestHere.score) bestHere = { angle, power, score };
    }
    if (!best || bestHere.score > best.robustness)
      best = { pieces: h.placed.map(p => ({ x: p.x, y: p.y, deg: p.deg })), angle: bestHere.angle, power: bestHere.power, robustness: bestHere.score };
  }
  return best;
}
