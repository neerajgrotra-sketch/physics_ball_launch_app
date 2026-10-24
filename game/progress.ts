// Level unlocking and the win card's wording, as in reference/prototype.html. Pure: no UI imports.
import { golfName, scoreFor, starsFor } from './score';

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
  /** 0–3. Assisted wins (hint or Solve) earn none. */
  stars: number;
  /** Points for this win, or null when assisted. */
  score: number | null;
  /** Left button: starts the level over from scratch (Watch again replays the winning shot). */
  again: string;
  /** Right button: the next level, or this one again after the last. */
  go: string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Card text after the ball lands. `assisted`: 'solve' when the Solve button took the shot, 'hint' when a
 * hint was used on this level; either way there are no stars or score.
 */
export function winText(opts: {
  assisted: 'solve' | 'hint' | null; tries: number; bounces: number; par: number; last: boolean;
}): WinText {
  const { assisted, tries, bounces, par, last } = opts;
  const go = last ? 'Play again' : 'Next level';
  if (assisted === 'solve') {
    return { title: 'Here’s one way in', detail: `${plural(bounces, 'bounce')}, par ${par}`, stars: 0, score: null, again: 'Try it yourself', go };
  }
  if (assisted === 'hint') {
    return { title: 'In, with a hint', detail: `${plural(bounces, 'bounce')}, par ${par}. Win it without help for stars.`, stars: 0, score: null, again: 'Start over', go };
  }
  const name = golfName(bounces, par);
  return {
    title: name.startsWith('+') ? 'In the glass' : `${name}!`,
    detail: `${plural(bounces, 'bounce')}, par ${par} · ${tries === 1 ? 'first try' : `${tries} tries`}`,
    stars: starsFor(bounces, par),
    score: scoreFor({ bounces, par, tries }),
    again: 'Start over',
    go,
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
