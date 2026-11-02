// The launch blast: when the ball fires, the gun kicks back and a muzzle flash, a shock ring, sparks and smoke burst from the end
// of the barrel, along the aim (drawn by components/board/Board.tsx MuzzleBlast). A look only: the ball still leaves LAUNCHER.
// Fixed spread, no random numbers, so every launch looks the same. Pure: no UI imports.
import { LAUNCHER } from '../physics';

/** How long the blast plays (ms). The smoke is the last to go. */
export const BLAST_MS = 1300;
/** How far back the gun kicks (board units), at its furthest. */
export const RECOIL = 5;

/** How far along the aim each gun's muzzle is from the ball's resting point (the tip of its barrel; just ahead of the ball otherwise). */
const REACH: Record<string, number> = { classic: 27, brass: 33, pirate: 34, blaster: 32, slingshot: 12, cue: 12 };

/** The end of the barrel for a gun aimed at `angle` degrees: [x, y], and the aim's direction [ux, uy] (screen y is down). */
export function muzzle(gunId: string, angle: number): { at: [number, number]; u: [number, number] } {
  const a = (angle * Math.PI) / 180;
  const u: [number, number] = [Math.cos(a), -Math.sin(a)];
  const reach = REACH[gunId] ?? REACH.classic;
  return { at: [LAUNCHER.x + u[0] * reach, LAUNCHER.y + u[1] * reach], u };
}

/** One spark: an angle off the aim (radians), a speed (board units/s) and a size. */
export interface Spark { off: number; speed: number; size: number }
/** One puff of smoke: how far along the aim and to the side it drifts, and how big it grows. */
export interface Puff { along: number; side: number; r: number; delay: number }

/** The sparks: a cone of about ±30° round the aim, the fastest down the middle. */
export function blastSparks(n = 14): Spark[] {
  return Array.from({ length: n }, (_, k) => {
    const s = n > 1 ? k / (n - 1) : 0.5; // 0 … 1 across the cone
    const j = ((k * 7919) % 11) / 11;    // a repeatable wobble
    const off = (s - 0.5) * 1.05 + (j - 0.5) * 0.15;
    return { off, speed: 260 + 220 * (1 - Math.abs(s - 0.5) * 2) + j * 60, size: 1.2 + (k % 3) * 0.6 };
  });
}

/** The smoke: puffs rolling out along the aim, each a moment after the last, drifting a little to the sides. */
export function blastPuffs(n = 6): Puff[] {
  return Array.from({ length: n }, (_, k) => ({ along: 14 + k * 9, side: (k % 2 ? 1 : -1) * (3 + (k % 3) * 3), r: 7 + k * 1.6, delay: k * 0.05 }));
}

/** How far the gun is kicked back at progress p (0–1): a sharp kick, then an easy return. */
export function recoilAt(p: number): number {
  'worklet';
  if (p <= 0 || p >= 1) return 0;
  return p < 0.04 ? RECOIL * (p / 0.04) : RECOIL * Math.max(0, 1 - (p - 0.04) / 0.26) ** 2;
}
