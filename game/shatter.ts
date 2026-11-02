// The ball shattering on a hazard: shards, embers and smoke, laid out once per death and then played back in slow motion by the
// board (components/board/Board.tsx Shatter). Deterministic (seeded by where the ball died), so a death looks the same every time
// it's seen, like everything else in the game. Pure: no UI imports.

/** How long the slow-motion shatter plays, in real milliseconds. */
export const SHATTER_MS = 2800;
/** How much "physics time" (seconds) the shards live through over that: 0.9 s stretched to 2.8 s is the slow motion. */
export const SHATTER_TIME = 0.9;
/** Gravity on the shards (board units/s²): lighter than the ball's, so they hang in the air a moment. */
export const SHARD_GRAVITY = 520;
/** How hard the clock eases: the burst's first instant runs at speed, then everything drifts. */
export const SLOW = 1.6;

export interface Shard {
  /** Launch velocity (board units/s). */
  vx: number; vy: number;
  /** Spin (radians per second of physics time). */
  spin: number;
  /** Triangle corners relative to its centre. */
  pts: [number, number][];
  /** Physics time when it reaches the floor (Infinity if it never does within SHATTER_TIME). */
  land: number;
  /** 0 steel, 1 hot (glowing orange), 2 dark. */
  tone: 0 | 1 | 2;
}

export interface Ember { vx: number; vy: number; r: number; wobble: number; phase: number }
export interface Puff { dx: number; dy: number; r: number }

/** A small seeded random generator (LCG), so the same death always shatters the same way. */
function rng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * The pieces for a ball that died at (x, y) moving at (vx, vy): `n` shards burst outwards and carry on some of the ball's momentum,
 * embers drift up, and a few puffs of smoke. `floor` is the y the shards come to rest on (the floor, less a little).
 */
export function shatterPieces(x: number, y: number, vx: number, vy: number, floor: number, n = 22) {
  const rand = rng(Math.round(x) * 7919 + Math.round(y) * 104729 + 17);
  const carry = 0.2; // share of the ball's own velocity the shards keep
  const shards: Shard[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + (rand() - 0.5) * 0.6;
    const speed = 45 + rand() * 120;
    const svx = Math.cos(a) * speed + vx * carry;
    const svy = Math.sin(a) * speed + vy * carry - 40; // a little upward kick
    const size = k < 4 ? 7 + rand() * 3 : 3.5 + rand() * 4; // a few big chunks among the splinters
    const pts: [number, number][] = [0, 1, 2].map((j) => {
      const ang = (j / 3) * Math.PI * 2 + (rand() - 0.5) * 1.2;
      const r = size * (0.7 + rand() * 0.6);
      return [Math.cos(ang) * r, Math.sin(ang) * r];
    });
    shards.push({ vx: svx, vy: svy, spin: (rand() - 0.5) * 18, pts, land: landTime(y, svy, floor), tone: (k % 3) as 0 | 1 | 2 });
  }
  const embers: Ember[] = Array.from({ length: 12 }, () => ({
    vx: (rand() - 0.5) * 60, vy: -(30 + rand() * 50), r: 1.3 + rand() * 1.6, wobble: 4 + rand() * 8, phase: rand() * Math.PI * 2,
  }));
  const puffs: Puff[] = Array.from({ length: 5 }, () => ({ dx: (rand() - 0.5) * 22, dy: (rand() - 0.5) * 14, r: 10 + rand() * 12 }));
  return { shards, embers, puffs };
}

/** When something thrown from height y with vertical speed vy reaches `floor` under SHARD_GRAVITY (Infinity if not in time). */
export function landTime(y: number, vy: number, floor: number): number {
  if (y >= floor) return 0;
  // y + vy t + g t²/2 = floor  →  t = (-vy + √(vy² + 2g(floor - y))) / g
  const t = (-vy + Math.sqrt(vy * vy + 2 * SHARD_GRAVITY * (floor - y))) / SHARD_GRAVITY;
  return t <= SHATTER_TIME ? t : Infinity;
}

/**
 * Where a shard is at physics time `t` after the burst: in flight it follows its arc and spins; once landed it skids a little further
 * along the floor and stops turning.
 */
export function shardAt(s: Shard, x: number, y: number, t: number, floor: number): { x: number; y: number; rot: number } {
  const air = Math.min(t, s.land);
  const slide = Math.max(0, t - s.land);
  const px = x + s.vx * air + s.vx * 0.2 * Math.min(slide, 0.25);
  const py = Math.min(floor, y + s.vy * air + 0.5 * SHARD_GRAVITY * air * air);
  return { x: px, y: py, rot: s.spin * air };
}

/** Slow motion: real progress u (0–1) to physics time. Fast for the first instant (the burst), then stretched out. */
export function shatterClock(u: number): number {
  const v = Math.min(1, Math.max(0, u));
  return SHATTER_TIME * (1 - (1 - v) ** SLOW);
}
