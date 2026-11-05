// Which background track a session plays: the tracks of each mode take turns, one session after another, so every visit sounds
// different from the last (a random pick could play the same one several times running). Pure: no UI imports.

export const MUSIC_TURN_KEY = 'bank-shot/music-turn';

/** The stored turn count, or 0 for a first visit or anything unreadable. */
export function parseTurn(raw: string | null | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

/** This session's pick from a mode's tracks: turn 0 plays the first, turn 1 the second, and round again. */
export function trackForTurn<T>(tracks: T[], turn: number): T | undefined {
  return tracks.length ? tracks[turn % tracks.length] : undefined;
}

/**
 * Mix moves on a track each time a different level opens (player feedback, 0.68.0). `last` is the level that last opened (null before
 * any this session). The first level of a session keeps the track already playing on the levels screen, and opening the same level
 * again (or coming back to it from Settings) changes nothing. The levels screen itself never moves it.
 */
export function mixStepFor(step: number, last: string | null, levelId: string): { step: number; last: string | null } {
  if (levelId === 'levels') return { step, last };
  return { step: last !== null && levelId !== last ? step + 1 : step, last: levelId };
}
