import { buildWorld, simulate, type Level, type PlacedPiece, type Solution } from '../physics';
import { legalPlacement } from './geometry';

function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

type Candidate = { placed: PlacedPiece[]; angle: number; power: number };

/** Wins and bounces off every placed bar. The win rule already needs every bar; this checks it explicitly. */
export function usesEveryBar(level: Level, placed: PlacedPiece[], angle: number, power: number): boolean {
  const res = simulate(buildWorld(level, placed), angle, power, 2);
  if (!res.success) return false;
  const hit = new Set(res.hits.filter(h => h.kind === 'piece').map(h => h.piece));
  return placed.every((_, k) => hit.has(k));
}

/**
 * Builds chains along the ball's path, since random placement almost never finds one: pick a launch,
 * then put each bar somewhere on the path that follows the previous bar, and for the last bar sweep its
 * rotation for angles that drop the ball in the glass. Pieces sit at whole units and whole degrees,
 * angle/power on the 0.1 grid. A chain only counts if the ball bounces off every bar.
 */
export function findChains(level: Level, samples: number, seed: number, want: number): Candidate[] {
  const r = rng(seed);
  const specs = level.pieces;
  const found: Candidate[] = [];
  for (let n = 0; n < samples && found.length < want; n++) {
    const angle = +(10 + r() * 80).toFixed(1), power = +(15 + r() * 85).toFixed(1);
    const placed: PlacedPiece[] = [];
    let ok = true;
    for (let k = 0; k < specs.length && ok; k++) {
      const res = simulate(buildWorld(level, placed), angle, power, 2);
      // Only the stretch after the last bar the ball touched is free to put the next bar on.
      const lastHit = res.hits.filter(h => h.kind === 'piece').at(-1);
      const from = Math.max(lastHit ? lastHit.i + 4 : 12, 1), to = res.path.length - 2;
      if (to <= from) { ok = false; break; }
      const last = k === specs.length - 1;
      let placedOne = false;
      for (let attempt = 0; attempt < 12 && !placedOne; attempt++) {
        const [px, py] = res.path[from + Math.floor(r() * (to - from))];
        const deg0 = Math.floor(r() * 180), slide = (r() - 0.5) * specs[k].len * 0.7;
        const rad = (deg0 * Math.PI) / 180;
        const bar = {
          len: specs[k].len, restitution: specs[k].restitution,
          x: Math.round(px + Math.cos(rad) * slide), y: Math.round(py + Math.sin(rad) * slide), deg: deg0,
        };
        if (!legalPlacement(level, [...placed, bar])) continue;
        if (!last) { placed.push(bar); placedOne = true; break; }
        // Last bar: keep its position, try every rotation.
        for (let deg = 0; deg < 180; deg += 2) {
          const tryBar = { ...bar, deg };
          if (!legalPlacement(level, [...placed, tryBar])) continue;
          if (usesEveryBar(level, [...placed, tryBar], angle, power)) {
            found.push({ placed: [...placed, tryBar], angle, power });
            placedOne = true;
            break;
          }
        }
        if (placedOne) break;
      }
      if (!placedOne) ok = false;
    }
  }
  return found;
}

/** How many of the 7×7 neighbouring 0.1 inputs around (angle, power) also win. */
function robustness(level: Level, placed: PlacedPiece[], angle: number, power: number): number {
  const world = buildWorld(level, placed);
  let score = 0;
  for (let ea = -3; ea <= 3; ea++) for (let ep = -3; ep <= 3; ep++)
    if (simulate(world, +(angle + ea * 0.1).toFixed(1), +(power + ep * 0.1).toFixed(1), Infinity).success) score++;
  return score;
}

/** Scored bounces of a shot (see physics: every bounce until the ball first drops into the glass). */
export const bouncesOf = (level: Level, placed: PlacedPiece[], angle: number, power: number) =>
  simulate(buildWorld(level, placed), angle, power, Infinity).bounces;

/** A solution must be at least this forgiving (wins out of the 7×7 neighbouring inputs) to be stored. */
export const MIN_ROBUSTNESS = 8;

/**
 * Finds the fewest-bounce solution, which sets the level's par. Builds many chains that use every bar,
 * then, from the fewest bounces up, looks for the most forgiving launch on those chains: the angle/power
 * within ±0.6 that still uses every bar with exactly that many bounces, scored by how many of its 7×7
 * neighbouring 0.1 inputs also win. The first bounce count with a launch at least MIN_ROBUSTNESS forgiving
 * is par (a tighter shot with fewer bounces may exist, but Solve has to land on every engine).
 */
export function findSolution(level: Level, opts: { samples?: number; seed?: number; want?: number } = {}): (Solution & { robustness: number; par: number }) | null {
  const { samples = 400_000, seed = 1, want = 160 } = opts;
  const chains = findChains(level, samples, seed, want).map((c) => ({ ...c, bounces: bouncesOf(level, c.placed, c.angle, c.power) }));
  // Par can never be below the number of bars: a feather-light touch on a bar counts as touching it but not as a
  // bounce, which would let a solution "use" three bars in two bounces.
  const counts = [...new Set(chains.map((c) => c.bounces))].filter((n) => n >= level.pieces.length).sort((a, b) => a - b);
  for (const par of counts) {
    let best: (Solution & { robustness: number; par: number }) | null = null;
    for (const c of chains.filter((ch) => ch.bounces === par).slice(0, 20)) {
      const world = buildWorld(level, c.placed);
      for (let da = -6; da <= 6; da++) for (let dp = -6; dp <= 6; dp++) {
        const angle = +(c.angle + da * 0.1).toFixed(1), power = +(c.power + dp * 0.1).toFixed(1);
        if (angle < 0 || angle > 90 || power < 0 || power > 100) continue;
        const res = simulate(world, angle, power, Infinity);
        if (!res.success || res.bounces !== par || !usesEveryBar(level, c.placed, angle, power)) continue;
        const score = robustness(level, c.placed, angle, power);
        if (!best || score > best.robustness)
          best = { pieces: c.placed.map(p => ({ x: p.x, y: p.y, deg: p.deg })), angle, power, robustness: score, par };
      }
    }
    if (best && best.robustness >= MIN_ROBUSTNESS) return best;
  }
  return null;
}
