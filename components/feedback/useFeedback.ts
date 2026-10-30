import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import type { Hit } from '../../physics';
import { feedbackPrefs } from './SoundSettings';
import { localSound, setAudioModeOnce, sourceOf } from './localAudio';

// Sounds come from scripts/make-sounds.mjs. Re-run it to change them.
const SOUNDS = {
  launch: require('../../assets/sounds/launch.wav'),
  wall: require('../../assets/sounds/wall.wav'),
  bounce: require('../../assets/sounds/bounce.wav'),
  glass: require('../../assets/sounds/glass.wav'),
  land: require('../../assets/sounds/land.wav'),
  dead: require('../../assets/sounds/dead.wav'),
  boing: require('../../assets/sounds/boing.wav'),
  warp: require('../../assets/sounds/warp.wav'),
  star: require('../../assets/sounds/star.wav'),
  burst: require('../../assets/sounds/burst.wav'),
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
const pitch = (n: number) => 2 ** (ARPEGGIO[Math.min(n, ARPEGGIO.length - 1)] / 12);

type SoundName = keyof typeof SOUNDS;

/**
 * A few players for one sound, so quick repeats (a fast run of bounces) each get their own instead of cutting each other off.
 * Every player rewinds as soon as it finishes, so starting one is a plain play() from the top. Rewinding just before playing raced
 * on iOS: the seek was still pending when play() ran, so a sound could stay silent and then fire late, doubled with the next one.
 */
interface Voice { player: AudioPlayer; busy: boolean; started: number }
class Pool {
  private voices: Voice[];
  constructor(source: number | { uri: string }, size: number) {
    this.voices = Array.from({ length: size }, () => {
      // keepAudioSessionActive: by default every pause() also shuts the iPhone's audio session down (and the next play() starts it
      // up again), and these pause after every sound.
      const player = createAudioPlayer(source, { keepAudioSessionActive: true });
      const voice: Voice = { player, busy: false, started: 0 };
      player.addListener('playbackStatusUpdate', (st) => {
        if (!st.didJustFinish) return;
        player.pause();
        player.seekTo(0).catch(() => {}).finally(() => { voice.busy = false; });
      });
      return voice;
    });
  }

  play(volume: number, rate: number) {
    // A free voice if there is one; otherwise cut the one that started longest ago (it has to rewind first, so wait for that).
    const free = this.voices.find((v) => !v.busy);
    const voice = free ?? this.voices.reduce((a, b) => (a.started <= b.started ? a : b));
    const { player } = voice;
    voice.busy = true;
    voice.started = Date.now();
    player.volume = volume;
    player.shouldCorrectPitch = false; // varispeed: a faster rate also raises the pitch, for the arpeggio
    player.setPlaybackRate(rate);
    if (free) player.play();
    else { player.pause(); player.seekTo(0).catch(() => {}).finally(() => player.play()); }
  }
}

/**
 * One set of players for the whole app (every screen shares them). warmSounds() makes them at app start from files on the phone
 * (localAudio.ts), before any music plays, so ~25 players aren't being created mid-level; a sound needed before that is ready uses
 * the bundled source as before.
 */
let pools: Record<SoundName, Pool> | null = null;
const POOL_SIZE: Partial<Record<SoundName, number>> = { bounce: 3, wall: 3, glass: 3, star: 3 };
const makePools = (src: (name: SoundName) => number | { uri: string }) => Object.fromEntries(
  (Object.keys(SOUNDS) as SoundName[]).map((name) => [name, new Pool(src(name), POOL_SIZE[name] ?? 2)]),
) as Record<SoundName, Pool>;
function sounds(): Record<SoundName, Pool> {
  if (!pools) pools = makePools((name) => SOUNDS[name]);
  return pools;
}
let warming: Promise<void> | null = null;
export function warmSounds(): Promise<void> {
  warming ??= (async () => {
    setAudioModeOnce();
    const names = Object.keys(SOUNDS) as SoundName[];
    const files = await Promise.all(names.map((n) => localSound(SOUNDS[n])));
    if (!pools) pools = makePools((name) => sourceOf(files[names.indexOf(name)]));
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
      play('launch', 0.8);
    },
    hit(h: Hit) {
      const strength = Math.max(0.2, Math.min(1, h.speed / HARD_HIT));
      const style = h.kind === 'piece' && strength > 0.6
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light;
      buzz(Haptics.impactAsync, h.kind === 'pad' || h.spring ? Haptics.ImpactFeedbackStyle.Heavy : style);
      if (h.kind === 'pad' || h.spring) play('boing', Math.max(0.7, strength));
      else if (h.kind === 'glass') play('glass', strength);
      else if (h.kind === 'wall' || h.kind === 'block') play('wall', strength * (h.kind === 'block' ? 0.8 : 0.6));
      else play('bounce', Math.max(0.6, strength), pitch(barHits.current++));
    },
    landed() {
      buzz(Haptics.notificationAsync, Haptics.NotificationFeedbackType.Success);
      play('land', 1);
    },
    star(k: number) {
      buzz(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Light);
      play('star', 0.8, 2 ** (([0, 4, 7][k] ?? 7) / 12));
    },
    burst() {
      buzz(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Medium);
      play('burst', 0.85);
    },
    warped() {
      buzz(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Light);
      play('warp', 0.8);
    },
    died() {
      buzz(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Soft);
      play('dead', 0.7);
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
