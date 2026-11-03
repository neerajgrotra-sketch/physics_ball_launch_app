// ASMR mode (Settings): a neon look (theme/palettes.ts NEON) with glow, comet tails and bounce flashes on the board, and a calm
// musical note on every bounce instead of the usual tinks and toks. A look and a sound only: the physics never changes. Pure.

import { blockCorners, type Hit, type Level } from '../physics';
import { distToSegment } from './pieces';

export const ASMR_KEY = 'bank-shot/asmr';

/** The notes a shot walks through, in semitones above the chime's own pitch: a major pentatonic, so any run of them sounds good. */
export const ASMR_SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19] as const;

/**
 * Semitones for the n-th bounce of a shot (0-based): up the scale, then back down and up again, so a long chain keeps rising and
 * falling like a melody instead of getting stuck on the top note.
 */
export function asmrStep(n: number): number {
  const top = ASMR_SCALE.length - 1;
  const k = n % (2 * top);
  return ASMR_SCALE[k <= top ? k : 2 * top - k];
}

/** The playback rate that plays the chime at the n-th bounce's note (varispeed: rate 2 is an octave up). */
export const asmrRate = (n: number) => 2 ** (asmrStep(n) / 12);

/**
 * What a bounce struck, for ASMR mode's flash on it (Board): a placed bar's index (0, 1, 2…), BLOCK_HIT + a block's index, or -1 for
 * anything else (walls, the glass; pads flash on their own). A hit records which bar it was; for a block it's the one nearest the ball.
 */
export const BLOCK_HIT = 100;
export function hitTarget(level: Level, h: Hit, at: [number, number]): number {
  if (h.kind === 'piece' && h.piece != null) return h.piece;
  if (h.kind !== 'block' || !level.blocks?.length) return -1;
  let best = -1, bestD = Infinity;
  level.blocks.forEach((b, k) => {
    const pts = blockCorners(b);
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length];
      const d = distToSegment({ x: at[0], y: at[1] }, [p[0], p[1], q[0], q[1]]);
      if (d < bestD) { bestD = d; best = k; }
    });
  });
  return best < 0 ? -1 : BLOCK_HIT + best;
}
