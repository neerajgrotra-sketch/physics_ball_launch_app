import { useEffect } from 'react';
import type { Hit } from '../../physics';
import { asmrRate } from '../../game/asmr';
import { feedbackPrefs } from './SoundSettings';
import { buffer, play as playBuffer, resume } from './webAudio';

// Web version of useFeedback.ts. Sounds play through the shared Web Audio context (webAudio.ts) from
// buffers decoded once, so a bounce costs almost nothing. Phones can't vibrate from a web page, so
// there are no haptics here.

const SOUNDS = {
  launch: require('../../assets/sounds/launch.wav'),
  bounce: require('../../assets/sounds/bounce.wav'),
  wall: require('../../assets/sounds/wall.wav'),
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
  bloom2: require('../../assets/sounds/bloom2.wav'),
  bloom1: require('../../assets/sounds/bloom1.wav'),
  stamp: require('../../assets/sounds/stamp.wav'),
};
type Sound = keyof typeof SOUNDS;

/** Bounce speed (px/s) that counts as a full-strength hit. Launches top out at 1120. */
const HARD_HIT = 700;


/** Each bar hit in a shot climbs a major arpeggio (semitones), so a chain sounds like it's building up. */
const ARPEGGIO = [0, 4, 7, 12, 16, 19, 24];
let clunks = 0;
const pitch = (n: number) => 2 ** (ARPEGGIO[Math.min(n, ARPEGGIO.length - 1)] / 12);
let barHits = 0;

const decoded: Partial<Record<Sound, AudioBuffer>> = {};
let loading: Promise<void> | null = null;
function load() {
  loading ??= Promise.all((Object.keys(SOUNDS) as Sound[]).map(async (name) => {
    const b = await buffer(SOUNDS[name]);
    if (b) decoded[name] = b;
  })).then(() => undefined);
  return loading;
}

function play(name: Sound, volume: number, rate = 1) {
  const b = decoded[name];
  if (b && feedbackPrefs.effects) playBuffer(b, volume, false, rate);
}

export function useFeedback() {
  // Decode up front (no tap needed for that), so the very first Launch is heard.
  useEffect(() => { load(); }, []);
  return {
    /** Call from a tap (Launch, Solve, the board): browsers only start audio from a user gesture. */
    prime() {
      resume();
      load();
    },
    launched() {
      barHits = 0;
      play('launch', feedbackPrefs.asmr ? 0.45 : 0.85); // the cannon's boom (the board shows the muzzle blast)
    },
    hit(h: Hit) {
      const strength = Math.max(0.2, Math.min(1, h.speed / HARD_HIT));
      // ASMR mode: every bounce is the next note of a calm pentatonic run (game/asmr.ts) on a soft bell.
      if (feedbackPrefs.asmr) { play('chime', 0.35 + 0.45 * strength, asmrRate(barHits++)); return; }
      if (h.kind === 'pad' || h.spring) play('boing', Math.max(0.7, strength));
      else if (h.kind === 'glass') play('glass', strength);
      else if (h.kind === 'wall' || h.kind === 'block') play('wall', strength * (h.kind === 'block' ? 0.8 : 0.6));
      else play('bounce', Math.max(0.6, strength), pitch(barHits++));
    },
    /** The ball is in: in ASMR mode the bloom's sound for the win (game/bloom.ts: the full run for three stars, shorter for fewer). */
    landed(bloom: 'bloom' | 'bloom2' | 'bloom1' = 'bloom') {
      if (feedbackPrefs.asmr) play(bloom, 0.95); // the light bloom's harp run and chord
      else play('land', 1);
    },
    /** Star k (0-based) pops in on the win card: each a step higher up a major chord. */
    star(k: number) {
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
    /** The glass bursts into confetti. */
    burst() {
      if (!feedbackPrefs.asmr) play('burst', 0.85); // ASMR mode: the landing chord is enough
    },
    /** Today's stamp thumps onto the daily card (in ASMR mode, a glowing seal with a chime). */
    stamped() {
      play('stamp', 0.9);
      if (feedbackPrefs.asmr) play('chime', 0.45, 2);
    },
    /**
     * A bar turned into something (each refused −/+ press, or the slider pushed on): a solid clunk. Every press
     * clunks; successive ones swap between two pitches a touch apart, so a run of presses knocks rather than drones.
     */
    jammed() {
      // ASMR mode: a soft thock instead, stepping between two of the chimes' notes (E and D, a whole tone apart).
      if (feedbackPrefs.asmr) play('thock', 0.75, clunks++ % 2 ? 0.891 : 1);
      else play('clunk', 0.9, clunks++ % 2 ? 0.92 : 1);
    },
    warped() {
      play('warp', 0.8);
    },
    died() {
      // The ball shatters (slow motion on the board): crack, boom and shards tinkling down.
      play('shatter', feedbackPrefs.asmr ? 0.7 : 0.9);
    },
  };
}
