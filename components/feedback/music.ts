// Background music: a playlist of looping tracks (playlist.ts, generated from assets/music by scripts/make-playlist.mjs). The game's
// own tracks are composed by scripts/make-music.mjs: "Graph Paper", "Sketchbook", "Protractor" and "Set Square" for regular play,
// "Neon Drift", "Felt Glass", "Paper Lanterns" and "Tidewater" for ASMR mode (files named asmr-…), and more since. In Mix, each session starts on the next
// track per mode (game/musicTurn.ts), and each different level that opens moves on to the next one; toggling ASMR mode swaps to that mode's track. To add a track, put an MP3 or M4A
// in assets/music (an asmr- name for ASMR mode).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { MUSIC_TURN_KEY, mixStepFor, parseTurn, trackForTurn } from '../../game/musicTurn';
import { PLAYLIST, type Track } from './playlist';

export type { Track };

const REGULAR = PLAYLIST.filter((t) => !t.asmr);
const ASMR = PLAYLIST.filter((t) => t.asmr);
const forTurn = (turn: number) => ({
  regular: trackForTurn(REGULAR, turn) ?? PLAYLIST[0],
  asmr: trackForTurn(ASMR, turn) ?? trackForTurn(REGULAR, turn) ?? PLAYLIST[0],
});

// This session's tracks. Until the saved turn is read (a moment after start) they're turn 0's; then this session's, once. In Mix, each
// different level that opens moves on one more track (`mix`, game/musicTurn.ts mixStepFor).
let turn0 = 0;
let session = forTurn(0);
let mix = { step: 0, last: null as string | null };
let ready = false;
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;

/** Reads the turn, takes this session's tracks and saves the next turn. Runs once per app start; safe to call again. */
export function loadMusicTurn(): Promise<void> {
  loading ??= AsyncStorage.getItem(MUSIC_TURN_KEY)
    .then((raw) => parseTurn(raw))
    .catch(() => 0)
    .then((turn) => {
      turn0 = turn;
      session = forTurn(turn + mix.step);
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

// The player's own pick of track (Settings, under Background music), one per mode: a track's id, or null for "Mix" (each session plays
// the next track, as above). Remembered on the device; the players listen and switch at once.
export const MUSIC_PICK_KEY = 'bank-shot/music-pick';
type Picks = { regular: string | null; asmr: string | null };
let picks: Picks = { regular: null, asmr: null };
const pickListeners = new Set<() => void>();
let picksLoading: Promise<void> | null = null;
/** Reads the saved picks once per app run (the players and Settings call it). */
export function loadMusicPicks(): Promise<void> {
  picksLoading ??= AsyncStorage.getItem(MUSIC_PICK_KEY).then((raw) => {
    const o = raw ? JSON.parse(raw) : null;
    const ok = (id: unknown, asmr: boolean) => (typeof id === 'string' && PLAYLIST.some((t) => t.id === id && t.asmr === asmr) ? id : null);
    if (o && typeof o === 'object') { picks = { regular: ok(o.regular, false), asmr: ok(o.asmr, true) }; pickListeners.forEach((f) => f()); }
  }).catch(() => {});
  return picksLoading;
}
/** Picks a track for a mode (null: Mix). */
export function setMusicPick(asmr: boolean, id: string | null) {
  picks = { ...picks, [asmr ? 'asmr' : 'regular']: id };
  pickListeners.forEach((f) => f());
  AsyncStorage.setItem(MUSIC_PICK_KEY, JSON.stringify(picks)).catch(() => {});
}
export const musicPick = (asmr: boolean) => (asmr ? picks.asmr : picks.regular);

/** A level screen opened (`levels` for the list): in Mix, a different level from the last moves the music on to the next track. */
export function musicLevelOpened(levelId: string) {
  const next = mixStepFor(mix.step, mix.last, levelId);
  const moved = next.step !== mix.step;
  mix = next;
  if (!moved) return;
  session = forTurn(turn0 + mix.step);
  pickListeners.forEach((f) => f()); // the players re-pick (only a Mix mode's track changes)
}
/** How far Mix has moved this session (the native player re-picks its track when it changes). */
export const mixStep = () => mix.step;
/** The pick for a mode, re-rendering when any pick changes (and once the saved ones are read), or Mix moves on. */
export function useMusicPick(asmr: boolean): string | null {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    pickListeners.add(f);
    loadMusicPicks().then(f);
    return () => { pickListeners.delete(f); };
  }, []);
  return musicPick(asmr);
}

/** A track's name for people: its title ("graph-paper" is Graph Paper, "asmr-felt-glass" is Felt Glass). */
export const trackTitle = (t: Track) =>
  t.id.replace(/^asmr-/, '').split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
/** The tracks a mode can pick from, in name order. */
export const tracksFor = (asmr: boolean) => PLAYLIST.filter((t) => t.asmr === asmr);

/** The track to play: the player's pick for the mode, else the session's track. The level id is kept for a possible per-level override. */
export const trackFor = (_levelId: string, asmr = false): Track => {
  const id = musicPick(asmr);
  return (id && PLAYLIST.find((t) => t.id === id)) || (asmr ? session.asmr : session.regular);
};

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
