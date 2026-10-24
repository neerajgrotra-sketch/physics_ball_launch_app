import type { Hit } from '../../physics';
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
};
type Sound = keyof typeof SOUNDS;

/** Bounce speed (px/s) that counts as a full-strength hit. Launches top out at 1120. */
const HARD_HIT = 700;

const decoded: Partial<Record<Sound, AudioBuffer>> = {};
let loading: Promise<void> | null = null;
function load() {
  loading ??= Promise.all((Object.keys(SOUNDS) as Sound[]).map(async (name) => {
    const b = await buffer(SOUNDS[name]);
    if (b) decoded[name] = b;
  })).then(() => undefined);
  return loading;
}

function play(name: Sound, volume: number) {
  const b = decoded[name];
  if (b) playBuffer(b, volume);
}

export function useFeedback() {
  return {
    /** Call from a tap (Launch, Solve, the board): browsers only start audio from a user gesture. */
    prime() {
      resume();
      load();
    },
    launched() {
      play('launch', 0.8);
    },
    hit(h: Hit) {
      const strength = Math.max(0.2, Math.min(1, h.speed / HARD_HIT));
      if (h.kind === 'glass') play('glass', strength);
      else if (h.kind === 'wall') play('wall', strength * 0.8);
      else play('bounce', strength);
    },
    landed() {
      play('land', 1);
    },
    died() {
      play('dead', 0.7);
    },
  };
}
