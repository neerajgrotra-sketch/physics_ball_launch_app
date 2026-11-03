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
