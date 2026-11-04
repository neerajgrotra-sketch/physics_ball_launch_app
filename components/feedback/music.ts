// Background music: a playlist of looping tracks (playlist.ts, generated from assets/music by scripts/make-playlist.mjs). The game's
// own tracks are composed by scripts/make-music.mjs: "Graph Paper", "Sketchbook", "Protractor" and "Set Square" for regular play,
// "Neon Drift", "Felt Glass", "Paper Lanterns" and "Tidewater" for ASMR mode (files named asmr-…). Each session plays one track per mode, on every level, and the next session plays the next one
// (game/musicTurn.ts), so each visit sounds different; toggling ASMR mode swaps to that mode's track. To add a track, put an MP3 or M4A
// in assets/music (an asmr- name for ASMR mode).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { MUSIC_TURN_KEY, parseTurn, trackForTurn } from '../../game/musicTurn';
import { PLAYLIST, type Track } from './playlist';

export type { Track };

const REGULAR = PLAYLIST.filter((t) => !t.asmr);
const ASMR = PLAYLIST.filter((t) => t.asmr);
const forTurn = (turn: number) => ({
  regular: trackForTurn(REGULAR, turn) ?? PLAYLIST[0],
  asmr: trackForTurn(ASMR, turn) ?? trackForTurn(REGULAR, turn) ?? PLAYLIST[0],
});

// This session's tracks. Until the saved turn is read (a moment after start) they're turn 0's; then this session's, once.
let session = forTurn(0);
let ready = false;
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;

/** Reads the turn, takes this session's tracks and saves the next turn. Runs once per app start; safe to call again. */
export function loadMusicTurn(): Promise<void> {
  loading ??= AsyncStorage.getItem(MUSIC_TURN_KEY)
    .then((raw) => parseTurn(raw))
    .catch(() => 0)
    .then((turn) => {
      session = forTurn(turn);
      ready = true;
      listeners.forEach((f) => f());
      AsyncStorage.setItem(MUSIC_TURN_KEY, String(turn + 1)).catch(() => {});
    });
  return loading;
}

/** Whether this session's tracks are settled (the players wait, so a session never starts on one track and swaps to another). */
export const musicReady = () => ready;

/** Re-renders when this session's tracks are settled. */
export function useMusicTurn(): boolean {
  const [isReady, setReady] = useState(ready);
  useEffect(() => {
    const f = () => setReady(true);
    listeners.add(f);
    loadMusicTurn();
    if (ready) setReady(true);
    return () => { listeners.delete(f); };
  }, []);
  return isReady;
}

/** The track to play: the session's track for the mode. The level id is kept for a possible per-level override later. */
export const trackFor = (_levelId: string, asmr = false): Track => (asmr ? session.asmr : session.regular);

/** Music sits well under the effects, and dips further while the ball is flying so bounces cut through. */
export const MUSIC_VOLUME = 0.18;
export const MUSIC_DUCKED = 0.06;

// The player's own level for the background music (Settings, "Background music" volume): a share of the game's level, 0 to 1.5, 1
// (today's level) by default. Remembered on the device; the players listen and follow it at once, during a drag too.
export const MUSIC_LEVEL_KEY = 'bank-shot/music-level';
export const MUSIC_LEVEL_MAX = 1.5;
let level = 1;
const levelListeners = new Set<() => void>();
let levelLoading: Promise<void> | null = null;

/** The background music's volume right now, for the player: the game's level (dipped during a shot) times the player's own. */
export const musicVolume = (ducked: boolean) => (ducked ? MUSIC_DUCKED : MUSIC_VOLUME) * level;
export const musicLevel = () => level;
/** Reads the saved level once per app run (the players call this when they start). */
export function loadMusicLevel(): Promise<void> {
  levelLoading ??= AsyncStorage.getItem(MUSIC_LEVEL_KEY).then((raw) => {
    const v = raw == null ? NaN : Number(raw);
    if (Number.isFinite(v)) { level = Math.max(0, Math.min(MUSIC_LEVEL_MAX, v)); levelListeners.forEach((f) => f()); }
  }).catch(() => {});
  return levelLoading;
}
/** Sets the level (the players follow at once); `save` writes it, done when a drag ends rather than on every step. */
export function setMusicLevel(v: number, save = true) {
  level = Math.max(0, Math.min(MUSIC_LEVEL_MAX, v));
  levelListeners.forEach((f) => f());
  if (save) AsyncStorage.setItem(MUSIC_LEVEL_KEY, String(level)).catch(() => {});
}
export function onMusicLevel(f: () => void): () => void {
  levelListeners.add(f);
  return () => { levelListeners.delete(f); };
}
/** The level, re-rendering when it changes (for the Settings slider). */
export function useMusicLevel(): number {
  const [v, setV] = useState(level);
  useEffect(() => {
    const f = () => setV(level);
    levelListeners.add(f);
    loadMusicLevel().then(f);
    return () => { levelListeners.delete(f); };
  }, []);
  return v;
}
