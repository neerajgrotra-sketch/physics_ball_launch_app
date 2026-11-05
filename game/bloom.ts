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
 * A win's bloom, by how good it was, so the full show stays a reward:
 * - 3 stars, the light bloom: everything, ending in the column of white light and the glass breathing out a white glow.
 * - 2 stars, the glow: the path, the glass filled, one mandala, ripples and fireflies, ending in a soft coloured halo. No white light.
 * - 1 star (or a helped win), the ember: the path and the glass half filled, a couple of ripples. Short and quiet.
 * `ms` is how long it runs (the win card waits for it); its parts keep BLOOM_PHASES' shares of it. `sound` is its landing sound.
 */
export interface BloomTier {
  tier: 1 | 2 | 3;
  ms: number;
  rings: number;
  flies: number;
  /** How many spirograph mandalas draw themselves. */
  mandalas: 0 | 1 | 2;
  /** How full the glass of light gets (share of its height). */
  fill: number;
  /** The column of light over the glass. */
  beam: boolean;
  /** The last glow out of the glass: white (3 stars), soft and coloured (2), or none. */
  halo: 'white' | 'soft' | null;
  sound: 'bloom' | 'bloom2' | 'bloom1';
}

export const BLOOM_TIERS: Record<1 | 2 | 3, BloomTier> = {
  3: { tier: 3, ms: BLOOM_MS, rings: 7, flies: 28, mandalas: 2, fill: 1, beam: true, halo: 'white', sound: 'bloom' },
  2: { tier: 2, ms: 3400, rings: 4, flies: 14, mandalas: 1, fill: 1, beam: false, halo: 'soft', sound: 'bloom2' },
  1: { tier: 1, ms: 2600, rings: 2, flies: 0, mandalas: 0, fill: 0.5, beam: false, halo: null, sound: 'bloom1' },
};

/** The bloom a win earns: three stars the full light bloom, two the glow, one star or a helped win the ember. */
export function bloomFor(stars: number, assisted: boolean): BloomTier {
  if (assisted) return BLOOM_TIERS[1];
  return BLOOM_TIERS[stars >= 3 ? 3 : stars === 2 ? 2 : 1];
}
