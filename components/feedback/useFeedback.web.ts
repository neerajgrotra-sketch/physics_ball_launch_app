import { Asset } from 'expo-asset';
import type { Hit } from '../../physics';

// Web version of useFeedback.ts. Sounds play through the Web Audio API from buffers decoded once, so a
// bounce costs almost nothing. (Restarting an <audio> element on every bounce stalled Safari for a
// frame or three, which showed up as the ball pausing at each collision.) Phones can't vibrate from a
// web page, so there are no haptics here.

const SOUNDS = {
  bounce: require('../../assets/sounds/bounce.wav'),
  glass: require('../../assets/sounds/glass.wav'),
  land: require('../../assets/sounds/land.wav'),
  dead: require('../../assets/sounds/dead.wav'),
};
type Sound = keyof typeof SOUNDS;

/** Bounce speed (px/s) that counts as a full-strength hit. Launches top out at 1120. */
const HARD_HIT = 700;

// One audio context and one set of decoded sounds for the whole app.
let ctx: AudioContext | null = null;
const buffers: Partial<Record<Sound, AudioBuffer>> = {};
let loading: Promise<void> | null = null;

function context(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

function load(ac: AudioContext): Promise<void> {
  loading ??= Promise.all(
    (Object.keys(SOUNDS) as Sound[]).map(async (name) => {
      const res = await fetch(Asset.fromModule(SOUNDS[name]).uri);
      buffers[name] = await ac.decodeAudioData(await res.arrayBuffer());
    }),
  ).then(() => undefined).catch(() => undefined); // sound is a nicety: never let it break a shot
  return loading;
}

function play(name: Sound, volume: number) {
  const ac = ctx, buffer = buffers[name];
  if (!ac || !buffer || ac.state !== 'running') return;
  const src = ac.createBufferSource();
  const gain = ac.createGain();
  gain.gain.value = volume;
  src.buffer = buffer;
  src.connect(gain).connect(ac.destination);
  src.start();
}

export function useFeedback() {
  return {
    /** Call from a tap (Launch, Solve): browsers only start audio from a user gesture. */
    prime() {
      const ac = context();
      if (!ac) return;
      if (ac.state === 'suspended') ac.resume().catch(() => {});
      load(ac);
    },
    hit(h: Hit) {
      const strength = Math.max(0.2, Math.min(1, h.speed / HARD_HIT));
      if (h.kind === 'glass') play('glass', strength);
      else play('bounce', h.kind === 'wall' ? strength * 0.5 : strength);
    },
    landed() {
      play('land', 1);
    },
    died() {
      play('dead', 0.7);
    },
  };
}
