// Level unlocking and the win card's wording, as in reference/prototype.html. Pure: no UI imports.
import { golfName, nextStarsText, scoreFor, starsFor } from './score';

/**
 * Level locks: on. A level opens once the one before it is won (settings has a testing switch to open them all).
 */
export const LOCK_LEVELS = true;

/** Turning locks on (0.23.0) started every device again from level 1, once: this marks that it has happened. */
export const FRESH_KEY = 'bank-shot/fresh';
export const FRESH_VERSION = 'locks-1';
/** Testing switch in settings: open every level. */
export const UNLOCK_ALL_KEY = 'bank-shot/unlock-all';

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
  /** What earns more stars next time (null at three stars or when assisted). */
  next: string | null;
  /** Left button: starts the level over from scratch (Replay plays the winning shot again). */
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
  assisted: 'solve' | 'hint' | 'tutorial' | null; tries: number; bounces: number; par: number; last: boolean;
}): WinText {
  const { assisted, tries, bounces, par, last } = opts;
  const go = last ? 'Play again' : 'Next level';
  if (assisted === 'solve') {
    return { title: 'Here’s one way in', detail: `${plural(bounces, 'bounce')}, par ${par}`, stars: 0, score: null, next: null, again: 'Try it yourself', go };
  }
  if (assisted === 'tutorial') {
    return {
      title: 'You’ve got it!', detail: `${plural(bounces, 'bounce')}, par ${par}. That’s the whole game: now win levels for stars.`,
      stars: 0, score: null, next: null, again: 'Try it yourself', go,
    };
  }
  if (assisted === 'hint') {
    return { title: 'In, with a hint', detail: `${plural(bounces, 'bounce')}, par ${par}. Win it without help for stars.`, stars: 0, score: null, next: null, again: 'Start over', go };
  }
  const name = golfName(bounces, par);
  return {
    title: name.startsWith('+') ? 'In the glass' : `${name}!`,
    detail: `${plural(bounces, 'bounce')}, par ${par} · ${tries === 1 ? 'first try' : `${tries} tries`}`,
    stars: starsFor(bounces, par),
    score: scoreFor({ bounces, par, tries }),
    next: nextStarsText(bounces, par),
    again: 'Start over',
    go,
  };
}

/**
 * Why a ball that landed in the glass didn't win (simulate() ended 'skipped'): not every bar was placed,
 * or the ball missed some. `numbers[i]` is the bar number of placed piece i; `touched[i]` whether the
 * ball hit it.
 */
export function skipNotice(total: number, numbers: number[], touched: boolean[], extras?: { pads?: { total: number; touched: boolean[] }; portals?: { total: number; used: boolean[] } }): string {
  const every = total === 1 ? 'the bar' : total === 2 ? 'both bars' : `all ${total} bars`;
  if (numbers.length < total) return `In the glass, but it has to bounce off ${every}. Place ${every} first.`;
  const missed = numbers.filter((_, i) => !touched[i]);
  const pads = extras?.pads, portals = extras?.portals;
  const padWord = !pads || pads.total === 0 ? '' : pads.total === 1 ? 'the spring pad' : 'both spring pads';
  const padsMissed = !!pads && pads.touched.some((t) => !t);
  const portalWord = !portals || portals.total === 0 ? '' : portals.total === 1 ? 'the portal' : 'both portals';
  const portalsMissed = !!portals && portals.used.some((u) => !u);
  if (missed.length === 0 && padsMissed) return `In the glass, but it never touched ${padWord}. It has to bounce off ${padWord} as well as ${every}.`;
  if (missed.length === 0 && portalsMissed) return `In the glass, but it never went through ${portalWord}. It has to go through ${portalWord} as well as bounce off ${every}.`;
  const names = missed.length === 1
    ? `Bar ${missed[0]}`
    : `Bars ${missed.slice(0, -1).join(', ')} and ${missed[missed.length - 1]}`;
  return `In the glass, but it missed ${names}. It has to bounce off ${every}${padWord ? ` and ${padWord}` : ''}${portalWord ? ` and go through ${portalWord}` : ''}.`;
}
