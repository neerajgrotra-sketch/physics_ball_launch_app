// Background music: a playlist of looping tracks, and one of them is picked when the app starts and plays for the whole session, on every
// level. So each visit can sound a little different, and new music is just a new file. To add a track, put it in assets/music (MP3 or
// M4A, ideally a seamless loop under ~1 MB): scripts/make-playlist.mjs lists every file there in playlist.ts before each web build, and
// makes the phones' seamless WAV copies (playlist.native.ts).
import { PLAYLIST } from './playlist';

/** This session's track: chosen once, when the app starts (music is UI, not physics, so Math.random is fine here). */
const SESSION_TRACK = PLAYLIST[Math.floor(Math.random() * PLAYLIST.length)];

/** The track to play. Every level plays the session's track; the level id is kept for a possible per-level override later. */
export const trackFor = (_levelId: string): number => SESSION_TRACK;

/** Music sits well under the effects, and dips further while the ball is flying so bounces cut through. */
export const MUSIC_VOLUME = 0.18;
export const MUSIC_DUCKED = 0.06;
