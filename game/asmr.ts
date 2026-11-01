// ASMR mode (Settings): a neon look (theme/palettes.ts NEON) with glow, comet tails and bounce flashes on the board, and a calm
// musical note on every bounce instead of the usual tinks and toks. A look and a sound only: the physics never changes. Pure.

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
