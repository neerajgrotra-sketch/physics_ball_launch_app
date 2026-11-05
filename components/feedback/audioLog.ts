import { useEffect, useState } from 'react';

// A timeline of what the app's audio did since it started (Settings, Testing, "Audio log"), so a stutter on a phone can be matched
// to what happened at that moment: players being set up or warmed, sounds played, the music player buffering or stopping. Times
// are seconds since the app started. Kept in memory only, the last MAX entries.

const MAX = 600;
const t0 = Date.now();
const entries: string[] = [];
const listeners = new Set<() => void>();
const sinceStart = () => ((Date.now() - t0) / 1000).toFixed(2);

/** Notes one audio event. */
export function alog(what: string) {
  entries.push(`${sinceStart()}  ${what}`);
  if (entries.length > MAX) entries.shift();
  listeners.forEach((f) => f());
}

/** Empties the log (Settings), to start a fresh test. */
export function clearAudioLog() {
  entries.length = 0;
  alog('log cleared');
}

/** The log so far, re-rendering as it grows. */
export function useAudioLog(): string[] {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);
  return entries;
}
