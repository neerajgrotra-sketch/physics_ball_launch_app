import type { Vec } from '../physics';

// The win celebration, "light the fuse": a spark races along the winning shot from the cannon to the glass, then the glass bursts into
// confetti. The bigger the result the bigger the burst. Everything here is plain numbers, so the drawing (components/board/Board.tsx)
// stays cheap and Vitest can check it. Pure: no UI imports.

/** How long the whole thing runs (ms): the fuse takes the first 60%, the burst the rest. */
export const CELEBRATION_MS = 1700;
/** The share of the time the spark spends travelling. */
export const FUSE_SHARE = 0.6;

/** The burst for a win: confetti pieces and whether there is a second ring. A hint or Solve win gets a small one. */
export function burstFor(stars: number, assisted: boolean): { confetti: number; rings: number } {
  if (assisted) return { confetti: 8, rings: 1 };
  return stars >= 3 ? { confetti: 34, rings: 2 } : stars === 2 ? { confetti: 22, rings: 1 } : { confetti: 12, rings: 1 };
}

/**
 * The path as flat [x0, y0, x1, y1, …] and, for each point, how far along the line it is (0–1). A trip through a portal is a jump
 * and adds no length, so the spark hops across at once.
 */
export function fuseGeometry(path: Vec[], jumps: number[] = []): { flat: number[]; cum: number[] } {
  const flat: number[] = [], len: number[] = [0];
  const hop = new Set(jumps);
  path.forEach(([x, y], i) => {
    flat.push(x, y);
    if (i > 0) len.push(len[i - 1] + (hop.has(i) ? 0 : Math.hypot(x - path[i - 1][0], y - path[i - 1][1])));
  });
  const total = len[len.length - 1];
  return { flat, cum: len.map((l) => (total ? l / total : 1)) };
}

/** The confetti: a fixed spread (no random numbers), each piece with a launch angle (mostly upward), a speed and a colour slot. */
export function confettiPieces(n: number): { angle: number; speed: number; color: number; wide: boolean }[] {
  return Array.from({ length: n }, (_, k) => {
    const spread = n > 1 ? k / (n - 1) : 0.5;
    const jitter = ((k * 7919) % 13) / 13;            // a repeatable wobble
    return {
      angle: -Math.PI + 0.25 + spread * (Math.PI - 0.5) + (jitter - 0.5) * 0.25,
      speed: 150 + ((k * 31) % 7) * 22 + jitter * 40,
      color: k % 5,
      wide: k % 2 === 0,
    };
  });
}
