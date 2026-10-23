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
  /** Left button: starts the level over from scratch (Watch again replays the winning shot). */
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
    again: solved ? 'Try it yourself' : 'Start over',
    go: last ? 'Play again' : 'Next level',
  };
}

/**
 * Why a ball that landed in the glass didn't win (simulate() ended 'skipped'): not every bar was placed,
 * or the ball missed some. `numbers[i]` is the bar number of placed piece i; `touched[i]` whether the
 * ball hit it.
 */
export function skipNotice(total: number, numbers: number[], touched: boolean[]): string {
  const every = total === 1 ? 'the bar' : total === 2 ? 'both bars' : `all ${total} bars`;
  if (numbers.length < total) return `In the glass, but it has to bounce off ${every}. Place ${every} first.`;
  const missed = numbers.filter((_, i) => !touched[i]);
  const names = missed.length === 1
    ? `Bar ${missed[0]}`
    : `Bars ${missed.slice(0, -1).join(', ')} and ${missed[missed.length - 1]}`;
  return `In the glass, but it missed ${names}. It has to bounce off ${every}.`;
}
