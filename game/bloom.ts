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

/** How big the bloom is for a win: a better result gets more rings and fireflies; a helped win a small one. */
export function bloomFor(stars: number, assisted: boolean): { rings: number; flies: number } {
  if (assisted) return { rings: 3, flies: 10 };
  return stars >= 3 ? { rings: 7, flies: 28 } : stars === 2 ? { rings: 5, flies: 20 } : { rings: 4, flies: 14 };
}
