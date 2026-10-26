// Undo for the player's bar edits. Every change to the bars (place, move, turn, remove, a snap back) is one step; a drag or a
// slider that keeps changing things is grouped into a single step by time. Pure: no UI imports, so Vitest covers it.

export const HISTORY_LIMIT = 30;
/** Changes closer together than this belong to one gesture (a drag, a slider being held) and make one undo step. */
export const GROUP_MS = 700;

export interface History<T> {
  /** Earlier states, oldest first. */
  past: T[];
  /** When the last change was recorded (ms), to group a gesture's changes. */
  at: number;
}

export const emptyHistory = <T,>(): History<T> => ({ past: [], at: -Infinity });

/** The state `before` was replaced by something else at time `now`: remember `before` unless this continues a gesture. */
export function record<T>(h: History<T>, before: T, now: number): History<T> {
  const continues = now - h.at < GROUP_MS && h.past.length > 0;
  if (continues) return { past: h.past, at: now };
  return { past: [...h.past, before].slice(-HISTORY_LIMIT), at: now };
}

/** Step back: the state to return to and the history without it, or null when there is nothing to undo. */
export function undo<T>(h: History<T>): { state: T; history: History<T> } | null {
  if (h.past.length === 0) return null;
  const state = h.past[h.past.length - 1];
  return { state, history: { past: h.past.slice(0, -1), at: -Infinity } };
}
