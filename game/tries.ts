// What counts as a try. Physics is deterministic (the same bars, angle and power always give the same path), so firing the setup the
// last try was fired from again can't turn out any differently: it's a replay to watch, not a new try, and it isn't scored. The
// Launch button says "Replay ▶" while the board matches that setup. Pure: no UI imports.

/** The bars on the board and the aim, as a string: what a shot was fired from (its bounce markers belong to it too). */
export const setupKey = (pieces: { x: number; y: number; deg: number }[], angle: number, power: number): string =>
  `${pieces.map((p) => `${p.x},${p.y},${p.deg}`).join(';')}|${angle.toFixed(1)}|${power.toFixed(1)}`;

/** Whether launching `now` would only replay the last try (fired from `last`; '' when there's been none). */
export const isRerun = (last: string, now: string): boolean => last !== '' && last === now;

/** The note the first replay of an unchanged setup shows, once a visit. */
export const RERUN_NOTE = 'Same bars, same aim, same shot. Replays don’t count as a try: move a bar or change the aim for a new one.';
