import { alog } from './audioLog';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import type { Hit } from '../../physics';
import { asmrRate } from '../../game/asmr';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EFFECTS_KEY, effectsListeners, feedbackPrefs } from './SoundSettings';
import { audioPartReady, whenLoaded } from './audioReady';
import { localSound, setAudioModeOnce, sourceOf } from './localAudio';

// Sounds come from scripts/make-sounds.mjs. Re-run it to change them.
const SOUNDS = {
  launch: require('../../assets/sounds/launch.wav'),
  wall: require('../../assets/sounds/wall.wav'),
  bounce: require('../../assets/sounds/bounce.wav'),
  glass: require('../../assets/sounds/glass.wav'),
  land: require('../../assets/sounds/land.wav'),
  boing: require('../../assets/sounds/boing.wav'),
  warp: require('../../assets/sounds/warp.wav'),
  clunk: require('../../assets/sounds/clunk.wav'),
  thock: require('../../assets/sounds/thock.wav'),
  star: require('../../assets/sounds/star.wav'),
  burst: require('../../assets/sounds/burst.wav'),
  fuse: require('../../assets/sounds/fuse.wav'),
  spark: require('../../assets/sounds/spark.wav'),
  chime: require('../../assets/sounds/chime.wav'),
  shatter: require('../../assets/sounds/shatter.wav'),
  bloom: require('../../assets/sounds/bloom.wav'),
  stamp: require('../../assets/sounds/stamp.wav'),
};

/** Bounce speed (px/s) that counts as a full-strength hit. Launches top out at 1120. */
const HARD_HIT = 700;

/**
 * Haptics and sound for a shot: a thunk and whoosh at launch; on each bounce a tap plus a metallic tink
 * off a bar, a dull tok off the floor or an edge, or a clink off the glass (stronger and louder when
 * faster); a success buzz and chime when the ball settles in the glass; a soft thump on a dead surface.
 * Sounds play even with the silent switch on and mix with whatever else is playing.
 */
/** Each bar hit in a shot climbs a major arpeggio (semitones), so a chain sounds like it's building up. */
const ARPEGGIO = [0, 4, 7, 12, 16, 19, 24];
let clunks = 0;
const pitch = (n: number) => 2 ** (ARPEGGIO[Math.min(n, ARPEGGIO.length - 1)] / 12);

type SoundName = keyof typeof SOUNDS;

/**
 * A few players for one sound, so quick repeats (a fast run of bounces) each get their own instead of cutting each other off.
 * Every player rewinds as soon as it finishes, so starting one is a plain play() from the top. Rewinding just before playing raced
 * on iOS: the seek was still pending when play() ran, so a sound could stay silent and then fire late, doubled with the next one.
 *
 * A player is rewound and freed on a timer of its own sound's length, not when iOS reports it finished: that report comes with the
 * player's status updates, only about every half second, so a long-finished player still counted as busy, the next bounce had to cut
 * a playing one (rewind, then play), and the sound came late or not at all (0.62.5 to 0.64.1, once the players were cut to 20).
 */
interface Voice { player: AudioPlayer; busy: boolean; started: number; timer?: ReturnType<typeof setTimeout>; fades?: ReturnType<typeof setTimeout>[]; warming?: boolean }
/** The same sound started again within this many ms is merged into the first. */
const MERGE_MS = 45;
/** A sound's length when its player can't say yet (seconds): the longest effects (the bloom, the shatter) are longer, the rest shorter. */
const FALLBACK_SECONDS = 0.6;
class Pool {
  private voices: Voice[];
  constructor(source: number | { uri: string }, size: number, private name = '') {
    this.voices = Array.from({ length: size }, () => {
      // keepAudioSessionActive: by default every pause() also shuts the iPhone's audio session down (and the next play() starts it
      // up again), and these pause after every sound.
      const player = createAudioPlayer(source, { keepAudioSessionActive: true });
      const voice: Voice = { player, busy: false, started: 0 };
      // A backstop: if iOS says it finished before the timer does, rewind now.
      player.addListener('playbackStatusUpdate', (st) => { if (st.didJustFinish) this.rewind(voice); });
      return voice;
    });
  }

  /** Stops the voice at the start, ready to play, and frees it once the rewind has landed. */
  private rewind(voice: Voice) {
    clearTimeout(voice.timer);
    voice.timer = undefined;
    voice.fades?.forEach(clearTimeout);
    voice.fades = undefined;
    voice.warming = false;
    const { player } = voice;
    try { player.pause(); } catch { /* released */ }
    player.seekTo(0).catch(() => {}).finally(() => { voice.busy = false; });
  }

  /** Frees the native players (each loaded one holds an audio pipeline on the phone). */
  release() {
    this.voices.forEach((v) => { clearTimeout(v.timer); try { v.player.remove(); } catch { /* already gone */ } });
  }

  /** The players, to wait for them to load. */
  get players() { return this.voices.map((v) => v.player); }

  /** When this sound last started (ms). */
  private last = 0;

  /**
   * Plays each voice once, silently, then rewinds it: an iPhone player is slow to start the first time, so the first bounces of a
   * session came late (and got better with replays). Done at app start before the intro's shot, while nothing can be heard
   * (audioReady.ts), the pools a few at a time (`warmSounds`).
   */
  warmVoices(): Promise<void> {
    return this.voices.reduce((chain, voice) => chain.then(() => new Promise<void>((done) => {
      const { player } = voice;
      if (voice.busy) { done(); return; }
      voice.busy = true;
      voice.warming = true;
      try { player.volume = 0; player.play(); } catch { /* not loaded yet */ }
      // Only stop it if it's still warming: a real sound may have taken it meanwhile (the intro plays during the warm-up, and this
      // used to cut its sounds off 90 ms in, 0.64.3 to 0.66.0).
      setTimeout(() => { if (voice.warming) this.rewind(voice); setTimeout(done, 30); }, 90);
    })), Promise.resolve());
  }

  play(volume: number, rate: number): Voice | null {
    // Two hits a hair apart (a corner, or two events let through in one late frame) are one sound: played twice, they doubled.
    const now = Date.now();
    if (now - this.last < MERGE_MS) { alog(`merged ${this.name}`); return null; }
    this.last = now;
    // A free voice if there is one, or one only being warmed (taken over); otherwise cut the one that started longest ago (it has
    // to rewind first, so wait for that).
    const free = this.voices.find((v) => !v.busy) ?? this.voices.find((v) => v.warming);
    const wasWarming = !!free?.warming;
    const voice = free ?? this.voices.reduce((a, b) => (a.started <= b.started ? a : b));
    const { player } = voice;
    voice.busy = true;
    voice.warming = false;
    voice.fades?.forEach(clearTimeout);
    voice.fades = undefined;
    voice.started = Date.now();
    player.volume = volume;
    player.shouldCorrectPitch = false; // varispeed: a faster rate also raises the pitch, for the arpeggio
    player.setPlaybackRate(rate);
    // Free it again as soon as the sound is over (at this rate), plus a hair for the player to get going.
    const seconds = player.duration > 0 ? player.duration : FALLBACK_SECONDS;
    const arm = () => { clearTimeout(voice.timer); voice.timer = setTimeout(() => this.rewind(voice), (seconds / Math.max(0.25, rate)) * 1000 + 40); };
    alog(`play ${this.name} #${this.voices.indexOf(voice)}${free ? (wasWarming ? ' (was warming)' : '') : ' (cut a playing one)'}`);
    if (free && !wasWarming) { player.play(); arm(); }
    else {
      clearTimeout(voice.timer);
      player.pause();
      player.seekTo(0).catch(() => {}).finally(() => { player.play(); arm(); });
    }
    return voice;
  }

  /**
   * Plays the sound, then fades it out from `fadeAt` over `fadeFor` seconds and stops it: a shorter version of a long sound without
   * another player (the 2- and 1-star blooms on phones; each extra loaded player risks the music stalling).
   */
  playCut(volume: number, fadeAt: number, fadeFor: number) {
    const voice = this.play(volume, 1);
    if (!voice) return;
    const steps = 8;
    voice.fades = Array.from({ length: steps }, (_, k) => setTimeout(() => {
      try { voice.player.volume = volume * (1 - (k + 1) / steps); } catch { /* released */ }
      if (k === steps - 1) this.rewind(voice);
    }, (fadeAt + (fadeFor * (k + 1)) / steps) * 1000));
  }
}

/**
 * One set of players for the whole app (every screen shares them). warmSounds() makes them at app start from files on the phone
 * (localAudio.ts), before any music plays, so they aren't being created mid-level; a sound needed before that is ready uses
 * the bundled source as before.
 *
 * As few as possible: every loaded player holds its own audio pipeline on the iPhone, and with 43 of them the music stalled for a
 * moment whenever iOS reset them all (a press of the volume buttons, unlocking the phone, and just after they loaded, 2 to 3 s into a
 * level). One per sound, and two or three only for the sounds that come in quick runs (bounces off bars and walls, glass rattles, the ASMR
 * chimes, which ring for 1.4 s, the fuse's ticks): 28 in all. The shorter 2- and 1-star blooms reuse the bloom's player, faded out early. None
 * at all while Sound effects is off: they're released, and made again when it's turned back on (setEffectsOn).
 */
let pools: Record<SoundName, Pool> | null = null;
const POOL_SIZE: Partial<Record<SoundName, number>> = { bounce: 4, wall: 3, glass: 2, chime: 5, spark: 2 };
const makePools = (src: (name: SoundName) => number | { uri: string }) => Object.fromEntries(
  (Object.keys(SOUNDS) as SoundName[]).map((name) => [name, new Pool(src(name), POOL_SIZE[name] ?? 1, name)]),
) as Record<SoundName, Pool>;
function sounds(): Record<SoundName, Pool> {
  if (!pools) { alog('effects made from bundled files (needed before ready)'); pools = makePools((name) => SOUNDS[name]); }
  return pools;
}
let warming: Promise<void> | null = null;
let readSwitch = false;
export function warmSounds(): Promise<void> {
  warming ??= (async () => {
    setAudioModeOnce();
    // The switch is read here too: at app start the settings provider may not have loaded it yet, and with effects off there
    // should be no players at all.
    if (!readSwitch) {
      readSwitch = true; // only at app start: later the switch itself says (setEffectsOn), and its save may not have landed yet
      if ((await AsyncStorage.getItem(EFFECTS_KEY).catch(() => null)) === 'off') feedbackPrefs.effects = false;
    }
    if (!feedbackPrefs.effects) { warming = null; audioPartReady('effects'); return; }
    alog('effects: getting files');
    const names = Object.keys(SOUNDS) as SoundName[];
    const files = await Promise.all(names.map((n) => localSound(SOUNDS[n])));
    alog(`effects: files ready (${files.filter((f) => typeof f === 'string').length}/${files.length} local)`);
    if (!pools) {
      pools = makePools((name) => sourceOf(files[names.indexOf(name)]));
      // Let them load, then warm every voice, a few pools at a time, so the first bounces start as quickly as later ones. All of it
      // before the intro's shot (audioReady.ts): a player set up or first played while a sound plays makes that sound stutter.
      const made = pools;
      const list = Object.values(made);
      const all = list.flatMap((p) => p.players);
      alog(`effects: ${all.length} players made`);
      await whenLoaded(all, 2000);
      alog(`effects: ${all.filter((p) => p.isLoaded).length}/${all.length} loaded`);
      for (let i = 0; i < list.length; i += 4) {
        if (pools !== made) break;
        await Promise.all(list.slice(i, i + 4).map((p) => p.warmVoices()));
      }
    }
    alog('effects: warmed');
    audioPartReady('effects');
  })();
  return warming;
}

export function useFeedback() {
  const barHits = useRef(0);

  useEffect(() => {
    // Play even with the silent switch on (it muted every sound), still mixing with other audio. Once per app run (localAudio.ts).
    setAudioModeOnce();
  }, []);

  return {
    /** Web needs a user gesture to start audio (see useFeedback.web.ts); nothing to do here. */
    prime() {},
    launched() {
      barHits.current = 0;
      buzz(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Light);
      play('launch', feedbackPrefs.asmr ? 0.45 : 0.85); // the cannon's boom (the board shows the muzzle blast)
    },
    hit(h: Hit) {
      const strength = Math.max(0.2, Math.min(1, h.speed / HARD_HIT));
      const style = h.kind === 'piece' && strength > 0.6
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light;
      buzz(Haptics.impactAsync, h.kind === 'pad' || h.spring ? Haptics.ImpactFeedbackStyle.Heavy : style);
      // ASMR mode: every bounce is the next note of a calm pentatonic run (game/asmr.ts) on a soft bell.
      if (feedbackPrefs.asmr) { play('chime', 0.35 + 0.45 * strength, asmrRate(barHits.current++)); return; }
      if (h.kind === 'pad' || h.spring) play('boing', Math.max(0.7, strength));
      else if (h.kind === 'glass') play('glass', strength);
      else if (h.kind === 'wall' || h.kind === 'block') play('wall', strength * (h.kind === 'block' ? 0.8 : 0.6));
      else play('bounce', Math.max(0.6, strength), pitch(barHits.current++));
    },
    /** The ball is in: in ASMR mode the bloom's sound for the win (game/bloom.ts: the full run for three stars, shorter for fewer). */
    landed(bloom: 'bloom' | 'bloom2' | 'bloom1' = 'bloom') {
      buzz(Haptics.notificationAsync, Haptics.NotificationFeedbackType.Success);
      // The light bloom's harp run and chord; the shorter 2- and 1-star blooms are the same sound faded out early (no extra players).
      if (feedbackPrefs.asmr) {
        if (bloom === 'bloom') play('bloom', 0.95);
        else if (feedbackPrefs.effects) { try { sounds().bloom.playCut(0.95, bloom === 'bloom2' ? 2.6 : 1.6, 0.9); } catch { /* a nicety */ } }
      }
      else play('land', 1);
    },
    star(k: number) {
      buzz(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Light);
      if (feedbackPrefs.asmr) play('chime', 0.55, 2 ** ((12 + ([0, 4, 7][k] ?? 7)) / 12));
      else play('star', 0.8, 2 ** (([0, 4, 7][k] ?? 7) / 12));
    },
    /** The win's fuse is lit: it fizzes while the spark races the winning path (normal mode; ASMR mode's bloom has its own run). */
    fuse() {
      if (!feedbackPrefs.asmr) play('fuse', 0.6);
    },
    /** The spark passes the shot's k-th bounce (0-based): a tick, each a step higher, so the fuse retraces the shot's rhythm. */
    spark(k: number) {
      if (!feedbackPrefs.asmr) play('spark', 0.5, pitch(k));
    },
    burst() {
      buzz(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Medium);
      if (!feedbackPrefs.asmr) play('burst', 0.85); // ASMR mode: the landing chord is enough
    },
    /** Today's stamp thumps onto the daily card (in ASMR mode, a glowing seal with a chime). */
    stamped() {
      buzz(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Heavy);
      play('stamp', 0.9);
      if (feedbackPrefs.asmr) play('chime', 0.45, 2);
    },
    /**
     * A bar turned into something (each refused −/+ press, or the slider pushed on): a solid clunk, and a light buzz. Every press
     * clunks; successive ones swap between two pitches a touch apart, so a run of presses knocks rather than drones.
     */
    jammed() {
      buzz(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Light);
      // ASMR mode: a soft thock instead, stepping between two of the chimes' notes (E and D, a whole tone apart).
      if (feedbackPrefs.asmr) play('thock', 0.75, clunks++ % 2 ? 0.891 : 1);
      else play('clunk', 0.9, clunks++ % 2 ? 0.92 : 1);
    },
    warped() {
      buzz(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Light);
      play('warp', 0.8);
    },
    died() {
      // The ball shatters (slow motion on the board): a heavy jolt, then light taps as the shards land, with the crack, boom
      // and tinkling of shatter.wav.
      buzz(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Heavy);
      for (const ms of [140, 300, 520, 820]) setTimeout(() => buzz(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Light), ms);
      play('shatter', feedbackPrefs.asmr ? 0.7 : 0.9);
    },
  };
}

/**
 * Play a short effect. The pitch goes through setPlaybackRate(): on iOS `playbackRate` is read-only, and assigning it threw
 * before play() ran, which silenced every effect.
 */
function play(name: SoundName, volume: number, rate = 1) {
  if (!feedbackPrefs.effects) return;
  try {
    sounds()[name].play(volume, rate);
  } catch (e) {
    // Audio is a nicety: never let it break a shot. Say so in development, so a silent failure can't hide again.
    if (__DEV__) console.warn('Sound failed to play', e);
  }
}

/** A vibration, unless the player turned vibration off in Settings. */
function buzz<T>(fn: (style: T) => Promise<void>, style: T) {
  if (feedbackPrefs.haptics) fn(style).catch(() => {});
}

/** Sound effects switched on or off (Settings): off releases every effect player; on makes them again. */
export function setEffectsOn(on: boolean) {
  feedbackPrefs.effects = on;
  if (on) { warmSounds().catch(() => {}); return; }
  if (pools) Object.values(pools).forEach((p) => p.release());
  pools = null;
  warming = null;
}
effectsListeners.add(setEffectsOn);
