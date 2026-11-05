// ASMR mode's win, "light bloom" (drawn by components/board/Board.tsx Bloom): a pulse of light runs the winning path, the glass
// fills with liquid light, two spirograph mandalas draw themselves round it turning opposite ways, rings ripple out across the
// board, a column of light rises and fireflies spiral in and are drawn into the glass. Plain numbers only. Pure: no UI imports.
import type { Vec } from '../physics';

/** How long the bloom runs (ms). The win card waits for it. */
export const BLOOM_MS = 4600;

/** When each part plays, as shares (0–1) of BLOOM_MS: [start, end]. */
export const BLOOM_PHASES = {
  echo: [0, 0.3],      // the pulse runs the winning path
  fill: [0.2, 0.45],   // the glass fills with light
  mandala: [0.35, 0.8],// the spirographs draw themselves
  rings: [0.38, 1],    // ripples spread out across the board
  beam: [0.4, 0.95],   // a column of light over the glass
  fireflies: [0.3, 0.92],
  breath: [0.88, 1],   // a last soft pulse from the glass
  constellation: [0.3, 0.55], // 2 stars: the bounce stars join up into the shot's constellation
  flower: [0.32, 0.8],  // 2 stars: a flower of light draws its petals over the glass
  embers: [0.2, 0.95],  // 1 star: embers rise out of the glass
} as const;

/** 0 before a phase, 1 after it, rising linearly through it. */
export function phase(u: number, [a, b]: readonly [number, number]): number {
  'worklet';
  return Math.min(1, Math.max(0, (u - a) / (b - a)));
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/**
 * A spirograph (hypotrochoid): a pen `d` from the centre of a circle of radius `r` rolling inside one of radius `R`, scaled so the
 * curve reaches `size` from its centre. The curve closes after r / gcd(R, r) turns; `steps` points per turn.
 */
export function spirograph(R: number, r: number, d: number, size: number, steps = 90): Vec[] {
  const turns = r / gcd(R, r);
  const k = (R - r) / r, reach = R - r + d;
  const n = Math.round(steps * turns);
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * Math.PI * 2 * turns;
    return [((R - r) * Math.cos(t) + d * Math.cos(k * t)) * (size / reach), ((R - r) * Math.sin(t) - d * Math.sin(k * t)) * (size / reach)] as Vec;
  });
}

/** One firefly: starts on a ring `r0` from the glass at angle `a0`, spirals in `turns` times, arriving at `arrive` (share of its phase). */
export interface Firefly { a0: number; r0: number; turns: number; arrive: number; size: number; hue: 0 | 1 | 2 }

/** The fireflies for a win: more for a better one. Fixed spread (no random numbers), so a win always looks the same. */
export function fireflies(n: number): Firefly[] {
  return Array.from({ length: n }, (_, k) => {
    const j = ((k * 7919) % 17) / 17;
    return { a0: (k / n) * Math.PI * 2 + j * 0.4, r0: 110 + j * 70, turns: 0.6 + j * 0.8, arrive: 0.7 + j * 0.3, size: 1.4 + (k % 3) * 0.7, hue: (k % 3) as 0 | 1 | 2 };
  });
}

/** Where a firefly is at share `p` (0–1) of its phase, round (cx, cy): spiralling in, easing as it nears the glass. */
export function fireflyAt(f: Firefly, cx: number, cy: number, p: number): [number, number] {
  'worklet';
  const q = Math.min(1, p / f.arrive);
  const ease = 1 - (1 - q) * (1 - q);
  const r = f.r0 * (1 - ease);
  const a = f.a0 + f.turns * Math.PI * 2 * ease;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8];
}

/**
 * A win's bloom, by how good it was: each step up is longer and richer, and each has something its own (player feedback: the 2-star one
 * looked like the 3-star one with a part missing, and the 1-star one hardly showed).
 * - 3 stars, the light bloom: two spirograph mandalas, every ripple and firefly, the column of light and the white glow. Kept for three.
 * - 2 stars, the constellation: each bounce lights up as a star as the light runs past it, the stars join into the shot's constellation,
 *   the glass fills, a flower of light draws its petals over it, fireflies and a few ripples, a soft coloured halo.
 * - 1 star (or a helped win), the embers: the light runs the path, the glass warms half full, a fountain of embers rises out of it and
 *   drifts up flickering, one bright ripple, a warm glow.
 * `ms` is how long it runs (the win card waits for it); its parts keep BLOOM_PHASES' shares of it. `sound` is its landing sound.
 */
export interface BloomTier {
  tier: 1 | 2 | 3;
  ms: number;
  rings: number;
  flies: number;
  /** How many spirograph mandalas draw themselves (3 stars only). */
  mandalas: 0 | 2;
  /** The bounce stars and their constellation (2 stars). */
  constellation: boolean;
  /** The flower of light over the glass (2 stars). */
  flower: boolean;
  /** Embers rising out of the glass (1 star). */
  embers: number;
  /** How full the glass of light gets (share of its height). */
  fill: number;
  /** The column of light over the glass (3 stars only). */
  beam: boolean;
  /** The last glow out of the glass: white (3 stars only), soft and coloured (2), warm and small (1). */
  halo: 'white' | 'soft' | 'warm';
  sound: 'bloom' | 'bloom2' | 'bloom1';
}

export const BLOOM_TIERS: Record<1 | 2 | 3, BloomTier> = {
  3: { tier: 3, ms: BLOOM_MS, rings: 7, flies: 28, mandalas: 2, constellation: false, flower: false, embers: 0, fill: 1, beam: true, halo: 'white', sound: 'bloom' },
  2: { tier: 2, ms: 3600, rings: 3, flies: 12, mandalas: 0, constellation: true, flower: true, embers: 0, fill: 1, beam: false, halo: 'soft', sound: 'bloom2' },
  1: { tier: 1, ms: 2800, rings: 1, flies: 0, mandalas: 0, constellation: false, flower: false, embers: 24, fill: 0.55, beam: false, halo: 'warm', sound: 'bloom1' },
};

/** A rose curve (r = cos(kθ)): `k` odd gives k petals. Scaled to reach `size`; drawn as one line, so it can draw itself. */
export function rose(k: number, size: number, steps = 240): Vec[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = (i / steps) * Math.PI;
    const r = size * Math.cos(k * t);
    return [r * Math.cos(t), r * Math.sin(t)] as Vec;
  });
}

/** One ember: leaves the glass's mouth at `delay` (share of its phase), rising at an angle `a` from straight up, for `life`. */
export interface Ember { delay: number; a: number; rise: number; life: number; size: number; hue: 0 | 1 | 2; wobble: number }

/** The embers for a 1-star win. Fixed spread (no random numbers), so a win always looks the same. */
export function embers(n: number): Ember[] {
  return Array.from({ length: n }, (_, k) => {
    const j = ((k * 7919) % 23) / 23;
    return { delay: (k / n) * 0.45, a: (j - 0.5) * 1.1, rise: 140 + j * 120, life: 0.4 + ((k * 31) % 7) / 7 * 0.15, size: 2.2 + (k % 3) * 0.8, hue: (k % 3) as 0 | 1 | 2, wobble: 4 + j * 6 };
  });
}

/** Where an ember is at share `p` (0–1) of the embers' phase, from the glass's mouth (x, y): [x, y, opacity]. */
export function emberAt(e: Ember, x: number, y: number, p: number): [number, number, number] {
  'worklet';
  const q = (p - e.delay) / e.life;
  if (q <= 0 || q >= 1) return [x, y, 0];
  const ease = 1 - (1 - q) * (1 - q);
  const up = e.rise * ease;
  const px = x + Math.sin(e.a) * up + Math.sin(q * 9 + e.a * 5) * e.wobble * q;
  const py = y - Math.cos(e.a) * up;
  const flicker = 0.75 + 0.25 * Math.sin(q * 40 + e.a * 11);
  return [px, py, Math.min(1, q / 0.1) * (1 - q) * flicker];
}

/** The bloom a win earns: three stars the full light bloom, two the glow, one star or a helped win the ember. */
export function bloomFor(stars: number, assisted: boolean): BloomTier {
  if (assisted) return BLOOM_TIERS[1];
  return BLOOM_TIERS[stars >= 3 ? 3 : stars === 2 ? 2 : 1];
}
