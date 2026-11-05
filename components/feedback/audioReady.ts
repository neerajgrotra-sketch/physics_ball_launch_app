import { Platform } from 'react-native';

// Phones: the iPhone's audio stalls for a moment whenever a player is set up, so everything is set up before anything is heard. At
// app start the effect players load and warm up, and the music player loads, while the intro still shows its opening picture; the
// intro's shot (and its sounds) starts once that's done (or after a cap, so it never hangs). In 0.64.3 to 0.66.1 the 28 effect
// players loaded and warmed while the intro played, and its sounds came out jerky.

const waiting = new Set(['effects', 'music']);
const listeners = new Set<() => void>();

/** One part of the app's audio is set up ('effects' or 'music'). */
export function audioPartReady(part: 'effects' | 'music') {
  if (!waiting.delete(part) || waiting.size) return;
  listeners.forEach((f) => f());
  listeners.clear();
}

/** Resolves once all of the app's audio is set up, or after `capMs`. At once on the web (Web Audio has no such stalls). */
export function whenAudioReady(capMs: number): Promise<void> {
  if (Platform.OS === 'web' || !waiting.size) return Promise.resolve();
  return new Promise((done) => {
    const timer = setTimeout(() => { listeners.delete(f); done(); }, capMs);
    const f = () => { clearTimeout(timer); done(); };
    listeners.add(f);
  });
}

/** Waits (up to `capMs`) for every player to say it has loaded. */
export function whenLoaded(players: { isLoaded: boolean }[], capMs: number): Promise<void> {
  const start = Date.now();
  return new Promise((done) => {
    const check = () => {
      let all = true;
      try { all = players.every((p) => p.isLoaded); } catch { /* released */ }
      if (all || Date.now() - start > capMs) done(); else setTimeout(check, 50);
    };
    check();
  });
}
