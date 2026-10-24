import { Asset } from 'expo-asset';

// Web only: one Web Audio context for the whole app, shared by sound effects (useFeedback.web.ts) and
// level music (useLevelMusic.web.ts). Sounds are decoded once and played from memory, which is cheap
// (restarting <audio> elements stalled Safari). Browsers only start audio from a user gesture, so
// resume() must be called from a tap.

let ctx: AudioContext | null = null;
const buffers = new Map<number | string, Promise<AudioBuffer | null>>();

export function audioContext(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

/** Call from a tap: unlocks audio. Resolves once it's running (or immediately if it can't). */
export function resume(): Promise<void> {
  const ac = audioContext();
  if (!ac || ac.state !== 'suspended') return Promise.resolve();
  return ac.resume().catch(() => undefined);
}

export function running(): boolean {
  return ctx?.state === 'running';
}

/** Decode a bundled sound (a require()d asset) once; null if it can't be loaded. */
export function buffer(module: number): Promise<AudioBuffer | null> {
  let p = buffers.get(module);
  if (!p) {
    const ac = audioContext();
    p = !ac ? Promise.resolve(null) : fetch(Asset.fromModule(module).uri)
      .then((r) => r.arrayBuffer())
      .then((data) => ac.decodeAudioData(data))
      .catch(() => null); // sound is a nicety: never let it break the game
    buffers.set(module, p);
  }
  return p;
}

/** Play a decoded sound once (effects), or looped (music). Returns a stop function. */
export function play(buf: AudioBuffer, volume: number, loop = false): () => void {
  const ac = ctx;
  if (!ac || ac.state !== 'running') return () => {};
  const src = ac.createBufferSource();
  const gain = ac.createGain();
  gain.gain.value = volume;
  src.buffer = buf;
  src.loop = loop;
  src.connect(gain).connect(ac.destination);
  src.start();
  return () => {
    try { src.stop(); } catch { /* already stopped */ }
    src.disconnect();
  };
}
