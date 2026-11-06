// How loud each bounce plays (normal mode; ASMR mode has its chimes). Pure: no UI imports. Used by components/feedback/useFeedback.ts
// and its web twin, so the two can't drift apart.
//
// Louder for a harder hit, but every bounce stays audible: a wall bounce used to be strength × 0.6, so a slow one (a soft rebound, the
// settling hops at the end of a shot) played at about 0.12 and wasn't heard at all, though the audio log showed it playing (0.72.3).

/** Bounce speed (px/s) that counts as a full-strength hit. Launches top out at 1120. */
export const HARD_HIT = 700;

/** 0.2 to 1: how hard a hit was. */
export function hitStrength(speed: number): number {
  return Math.max(0.2, Math.min(1, speed / HARD_HIT));
}

/** The volume (0–1) for a bounce off a wall, the floor, a block or the glass, at `speed`: never below `floor`. */
export function hitVolume(kind: 'wall' | 'block' | 'glass', speed: number): number {
  const s = hitStrength(speed);
  if (kind === 'glass') return 0.4 + 0.6 * s;
  // Walls and the floor sit a little under the bars' metallic tink, blocks a little above the walls.
  return (kind === 'block' ? 0.45 : 0.4) + (kind === 'block' ? 0.4 : 0.35) * s;
}
