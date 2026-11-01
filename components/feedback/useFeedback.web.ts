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
  dead: require('../../assets/sounds/dead.wav'),
  boing: require('../../assets/sounds/boing.wav'),
  warp: require('../../assets/sounds/warp.wav'),
  star: require('../../assets/sounds/star.wav'),
  burst: require('../../assets/sounds/burst.wav'),
  chime: require('../../assets/sounds/chime.wav'),
  glow: require('../../assets/sounds/glow.wav'),
};
type Sound = keyof typeof SOUNDS;

/** Bounce speed (px/s) that counts as a full-strength hit. Launches top out at 1120. */
const HARD_HIT = 700;


/** Each bar hit in a shot climbs a major arpeggio (semitones), so a chain sounds like it's building up. */
const ARPEGGIO = [0, 4, 7, 12, 16, 19, 24];
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
      play('launch', feedbackPrefs.asmr ? 0.3 : 0.8);
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
    landed() {
      if (feedbackPrefs.asmr) play('glow', 0.9);
      else play('land', 1);
    },
    /** Star k (0-based) pops in on the win card: each a step higher up a major chord. */
    star(k: number) {
      if (feedbackPrefs.asmr) play('chime', 0.55, 2 ** ((12 + ([0, 4, 7][k] ?? 7)) / 12));
      else play('star', 0.8, 2 ** (([0, 4, 7][k] ?? 7) / 12));
    },
    /** The glass bursts into confetti. */
    burst() {
      if (!feedbackPrefs.asmr) play('burst', 0.85); // ASMR mode: the landing chord is enough
    },
    warped() {
      play('warp', 0.8);
    },
    died() {
      play('dead', 0.7);
    },
  };
}
