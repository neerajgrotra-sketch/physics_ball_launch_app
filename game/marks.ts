// Bounce markers: a numbered marker where each scored bounce of a shot happened (Hit.counts: bars, walls, the floor, the outside of the
// glass, not down inside it), so a player can see how the bounce count was made. Shown on the board during and after a shot when
// "Show bounce numbers" is on (Settings), and always on a challenge's replay. Pure: no UI imports.
import { WORLD, type Hit, type Vec } from '../physics';

export const MARKS_KEY = 'bank-shot/bounce-marks';

export interface Mark { x: number; y: number; n: number }

/** The markers for a shot, in order: one per scored bounce, at the ball's centre when it bounced. */
export function bounceMarks(res: { path: Vec[]; hits: Hit[] }): Mark[] {
  return res.hits.filter((h) => h.counts).map((h, k) => {
    const [x, y] = res.path[Math.min(h.i, res.path.length - 1)];
    return { x, y, n: k + 1 };
  });
}

/** What a bounce hit, in words. The board's edges and the floor are all 'wall' to physics, so the floor is told apart by height. */
export type BounceKind = 'bar' | 'wall' | 'floor' | 'glass' | 'spring pad';
export function bounceKind(h: Hit, at: Vec): BounceKind {
  if (h.kind === 'piece') return 'bar';
  if (h.kind === 'pad') return 'spring pad';
  if (h.kind === 'glass') return 'glass';
  return h.kind === 'wall' && at[1] >= WORLD.ground - 14 ? 'floor' : 'wall';
}
