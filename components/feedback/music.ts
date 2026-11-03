// Background music: a playlist of looping tracks (playlist.ts, generated from assets/music by scripts/make-playlist.mjs). The game's
// own tracks are composed by scripts/make-music.mjs: "Graph Paper" for regular play and "Neon Drift" for ASMR mode (files named
// asmr-…). One track per mode is picked when the app starts and plays for the whole session, on every level; toggling ASMR mode swaps
// to that mode's track. To add a track, put an MP3 or M4A in assets/music (an asmr- name for ASMR mode).
import { PLAYLIST, type Track } from './playlist';

export type { Track };

// This session's track for each mode: chosen once, when the app starts (music is UI, not physics, so Math.random is fine here).
const pick = (asmr: boolean): Track => {
  const mine = PLAYLIST.filter((t) => t.asmr === asmr);
  const from = mine.length ? mine : PLAYLIST;
  return from[Math.floor(Math.random() * from.length)];
};
const SESSION = { regular: pick(false), asmr: pick(true) };

/** The track to play: the session's track for the mode. The level id is kept for a possible per-level override later. */
export const trackFor = (_levelId: string, asmr = false): Track => (asmr ? SESSION.asmr : SESSION.regular);

/** Music sits well under the effects, and dips further while the ball is flying so bounces cut through. */
export const MUSIC_VOLUME = 0.18;
export const MUSIC_DUCKED = 0.06;
