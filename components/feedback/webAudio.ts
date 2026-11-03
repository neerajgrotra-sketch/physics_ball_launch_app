import { Asset } from 'expo-asset';

// Web only: one Web Audio context for the whole app, shared by sound effects (useFeedback.web.ts) and
// level music (useLevelMusic.web.ts). Sounds are decoded once and played from memory, which is cheap
// (restarting <audio> elements stalled Safari). Browsers only start audio from a user gesture, so
// resume() must be called from a tap.
//
// iPhone Safari pauses the context on its own: "suspended" after a while of silence, "interrupted" by a phone call, Siri or another
// app's audio. Only a real tap (touchend or click) can wake it, so a tap listener stays for good (below). And after an interruption
// WebKit can leave the context stuck, with resume() never taking effect however many taps follow; reloading the page was the only
// cure. So a context that won't wake is replaced with a fresh one inside the next tap (generation() counts the swaps, so the music
// knows to start again on the new one). Decoded sounds are kept: an AudioBuffer plays in any context.

let ctx: AudioContext | null = null;
let gen = 0;
let lastGain: GainNode | null = null;
const runningListeners = new Set<() => void>();

/** The gain node of the most recent play() (music uses it to duck). */
export function latestGain(): GainNode | null {
  return lastGain;
}
/** Which context is current: it goes up each time a stuck one is replaced. */
export function generation(): number {
  return gen;
}
const buffers = new Map<number | string, Promise<AudioBuffer | null>>();

function makeContext(): AudioContext | null {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  const ac = new AC();
  ac.addEventListener('statechange', () => {
    if (ac === ctx && ac.state === 'running') runningListeners.forEach((f) => f());
  });
  return ac;
}

export function audioContext(): AudioContext | null {
  if (!ctx) ctx = makeContext();
  return ctx;
}

/** Plays one silent sample inside a tap: some iOS versions only unlock (or wake) once a sound starts there. */
function kick(ac: AudioContext) {
  try {
    const src = ac.createBufferSource();
    src.buffer = ac.createBuffer(1, 1, 22050);
    src.connect(ac.destination);
    src.start(0);
  } catch { /* best effort */ }
}

function playbackSession() {
  const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
  if (session && session.type !== 'playback') {
    try { session.type = 'playback'; } catch { /* not allowed here */ }
  }
}

/**
 * Call from a tap: unlocks audio. Resolves once it's running (or immediately if it can't).
 * On iPhone, web audio is silenced by the silent switch unless the page asks for "playback" audio
 * (Safari 16.4+), and some iOS versions only unlock after a sound starts inside the tap, so a
 * one-sample silent buffer is played.
 */
export function resume(): Promise<void> {
  playbackSession();
  const ac = audioContext();
  if (!ac) return Promise.resolve();
  if (ac.state === 'running') return Promise.resolve();
  kick(ac);
  return ac.resume().catch(() => undefined);
}

export function running(): boolean {
  return ctx?.state === 'running';
}

/** Calls `cb` whenever audio starts running (after the first tap, after a wake, on a fresh context). Returns an unsubscribe function. */
export function onRunning(cb: () => void): () => void {
  audioContext();
  runningListeners.add(cb);
  return () => { runningListeners.delete(cb); };
}

/** Swaps a stuck context for a fresh one. Must run inside a tap, so the new one may start. */
function replace() {
  const old = ctx;
  const fresh = makeContext();
  if (!fresh) return;
  ctx = fresh;
  gen++;
  lastGain = null;
  playbackSession();
  kick(fresh);
  fresh.resume().catch(() => {});
  old?.close().catch(() => {});
}

/**
 * A tap anywhere. If audio isn't running: an interrupted context (a call, Siri) is replaced at once (WebKit often never brings it
 * back); a suspended one is asked to resume, and if that hasn't worked by the next tap, it's replaced then.
 */
let triedResume = false;
function wake() {
  const ac = audioContext();
  if (!ac) return;
  if (ac.state === 'running') { triedResume = false; return; }
  if ((ac.state as string) === 'interrupted' || triedResume) { triedResume = false; replace(); return; }
  triedResume = true;
  resume();
}

// Any tap anywhere unlocks audio, including the tap that opens a level from the list, so its music can
// start as the level loads. touchend and click count as user gestures on iPhone (pointerdown doesn't, nor do the
// pointer events behind the game's buttons). The listener stays for good (see the top of the file).
if (typeof document !== 'undefined') {
  const WAKE_EVENTS = ['touchend', 'click', 'keydown'] as const;
  for (const e of WAKE_EVENTS) document.addEventListener(e, wake, true);
  // Coming back to the page (another app, a call, the lock screen): try to wake it straight away too.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx && !running()) ctx.resume().catch(() => {});
  });
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

/** Play a decoded sound once (effects), or looped (music). `rate` > 1 raises the pitch. Returns a stop function. */
export function play(buf: AudioBuffer, volume: number, loop = false, rate = 1): () => void {
  const ac = ctx;
  if (!ac) return () => {};
  if (ac.state !== 'running') {
    // Paused by the browser: ask it to wake (this works when we're inside a tap, and is harmless otherwise). This sound is skipped.
    ac.resume().catch(() => {});
    return () => {};
  }
  const src = ac.createBufferSource();
  const gain = ac.createGain();
  gain.gain.value = volume;
  src.buffer = buf;
  src.loop = loop;
  src.playbackRate.value = rate;
  lastGain = gain;
  src.connect(gain).connect(ac.destination);
  src.start();
  return () => {
    try { src.stop(); } catch { /* already stopped */ }
    src.disconnect();
  };
}
