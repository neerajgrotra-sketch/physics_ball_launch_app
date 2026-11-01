// Ghost trails: how many past launches stay on the board (Settings, "Trails kept") and how faint each one is. Pure: no UI imports.

export const TRAILS_KEY = 'bank-shot/trails';
/** The choices in Settings. 3 by default: more and the long shots of the later worlds (springs, walls) tangle into a scribble. */
export const TRAIL_CHOICES = [1, 2, 3, 5, 8] as const;
export const DEFAULT_TRAILS = 3;
/** The most ever kept, so lowering the setting takes effect at once and raising it again brings nothing stale back. */
export const MAX_TRAILS = TRAIL_CHOICES[TRAIL_CHOICES.length - 1];

export function parseTrails(v: string | null | undefined): number {
  const n = Number(v);
  return (TRAIL_CHOICES as readonly number[]).includes(n) ? n : DEFAULT_TRAILS;
}

/**
 * Opacity of trail i of n (oldest first). The newest is clearly visible and older ones fall away steeply, so the eye goes to the
 * last shot: newest 0.6, the oldest of several down to 0.1.
 */
export function trailOpacity(i: number, n: number): number {
  if (n <= 1) return 0.6;
  const age = (n - 1 - i) / (n - 1); // 0 newest … 1 oldest
  return 0.1 + 0.5 * (1 - age) ** 1.5;
}
