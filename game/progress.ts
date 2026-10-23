// Level unlocking and the win card's wording, as in reference/prototype.html. Pure: no UI imports.

/** Storage key for the index of the furthest unlocked level. */
export const UNLOCKED_KEY = 'bank-shot/unlocked';

/** Read a stored unlock index, falling back to the first level for anything missing or malformed. */
export function parseUnlocked(raw: string | null, count: number): number {
  const n = parseInt(raw ?? '0', 10) || 0;
  return Math.max(0, Math.min(count - 1, n));
}

/** Winning level i unlocks the next one, if there is one. Unlocks never go backwards. */
export function unlockAfterWin(unlocked: number, i: number, count: number): number {
  return i + 1 > unlocked && i + 1 < count ? i + 1 : unlocked;
}

export interface WinText {
  title: string;
  detail: string;
  /** Left button: replays the level from scratch. */
  again: string;
  /** Right button: the next level, or this one again after the last. */
  go: string;
}

/** Card text after the ball lands. `solved` means the Solve button took the shot. */
export function winText(opts: { solved: boolean; tries: number; angle: number; power: number; last: boolean }): WinText {
  const { solved, tries, angle, power, last } = opts;
  return {
    title: solved ? 'Here’s one way in' : tries === 1 ? 'In the glass on the first try' : `In the glass in ${tries} tries`,
    detail: `Angle ${angle.toFixed(1)}°, power ${power.toFixed(1)}`,
    again: solved ? 'Try it yourself' : 'Replay level',
    go: last ? 'Play again' : 'Next level',
  };
}
