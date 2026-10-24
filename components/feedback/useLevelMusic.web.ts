import { useCallback, useEffect, useRef } from 'react';
import { trackFor, MUSIC_DUCKED, MUSIC_VOLUME } from './music';
import { audioContext, buffer, latestGain, onRunning, play, resume, running } from './webAudio';

/**
 * Web version of useLevelMusic.ts: loops the level's track through Web Audio while the level is open
 * and music is on. Browsers only allow audio after a tap; any tap unlocks it (webAudio.ts), so it starts
 * as the level loads when you came from the level list, otherwise on the first tap.
 */
export function useLevelMusic(levelId: string, on: boolean, duck = false) {
  const track = trackFor(levelId);
  const stop = useRef<(() => void) | null>(null);
  const gain = useRef<GainNode | null>(null);
  const ducked = useRef(duck);
  ducked.current = duck;
  const wanted = useRef(on);
  wanted.current = on;

  const start = useCallback(async () => {
    if (!track || stop.current || !wanted.current || !running()) return;
    const buf = await buffer(track);
    if (buf && !stop.current && wanted.current) {
      stop.current = play(buf, ducked.current ? MUSIC_DUCKED : MUSIC_VOLUME, true);
      gain.current = latestGain();
    }
  }, [track]);

  // Start as soon as audio is unlocked, and decode the track right away so that's instant.
  useEffect(() => {
    if (track) buffer(track);
    return onRunning(start);
  }, [track, start]);

  useEffect(() => {
    if (on) start();
    else { stop.current?.(); stop.current = null; }
  }, [on, start]);

  // Dip while the ball flies, with a short glide so it doesn't click.
  useEffect(() => {
    const ac = audioContext();
    if (ac && gain.current) gain.current.gain.setTargetAtTime(duck ? MUSIC_DUCKED : MUSIC_VOLUME, ac.currentTime, 0.08);
  }, [duck]);

  useEffect(() => () => { stop.current?.(); stop.current = null; }, []);

  return {
    /** Call from a tap: unlocks audio if needed, then starts the track. */
    prime() {
      resume().then(start);
      if (track) buffer(track); // start decoding right away
    },
  };
}
