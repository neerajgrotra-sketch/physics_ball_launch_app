import { useCallback, useEffect, useRef } from 'react';
import { trackFor, MUSIC_DUCKED, MUSIC_VOLUME } from './music';
import { audioContext, buffer, latestGain, onRunning, play, resume, running } from './webAudio';

/**
 * Web version of useLevelMusic.ts: loops the session's track through Web Audio while a level is open and music is on. One loop for
 * the whole app, held by the level screens that want it, so moving to the next level carries on instead of starting the track
 * again; when the last one lets go it stops after a short grace. Browsers only allow audio after a tap; any tap unlocks it
 * (webAudio.ts), so it starts as the level loads when you came from the level list, otherwise on the first tap.
 */
let current: { stop: () => void; gain: GainNode | null } | null = null;
let holders = 0;
let stopTimer: ReturnType<typeof setTimeout> | undefined;
let duckedNow = false;
const GRACE_MS = 700;

function stopNow() {
  clearTimeout(stopTimer);
  current?.stop();
  current = null;
}

export function useLevelMusic(levelId: string, on: boolean, duck = false) {
  const track = trackFor(levelId);
  const holding = useRef(false);
  duckedNow = duck;

  const start = useCallback(async () => {
    if (!track || !holding.current || current || !running()) return;
    const buf = await buffer(track);
    if (buf && holding.current && !current) {
      const stop = play(buf, duckedNow ? MUSIC_DUCKED : MUSIC_VOLUME, true);
      current = { stop, gain: latestGain() };
    }
  }, [track]);

  // Decode the track right away so starting is instant, and start as soon as audio is unlocked.
  useEffect(() => {
    if (track) buffer(track);
    return onRunning(start);
  }, [track, start]);

  useEffect(() => {
    if (!on) {
      if (holders === 0) stopNow();
      return;
    }
    holding.current = true;
    holders++;
    clearTimeout(stopTimer);
    start();
    return () => {
      holding.current = false;
      holders--;
      if (holders > 0) return;
      clearTimeout(stopTimer);
      stopTimer = setTimeout(() => { if (holders === 0) stopNow(); }, GRACE_MS);
    };
  }, [on, start]);

  // Dip while the ball flies, with a short glide so it doesn't click.
  useEffect(() => {
    const ac = audioContext();
    if (ac && current?.gain) current.gain.gain.setTargetAtTime(duck ? MUSIC_DUCKED : MUSIC_VOLUME, ac.currentTime, 0.08);
  }, [duck]);

  return {
    /** Call from a tap: unlocks audio if needed, then starts the track. */
    prime() {
      resume().then(start);
      if (track) buffer(track); // start decoding right away
    },
  };
}
