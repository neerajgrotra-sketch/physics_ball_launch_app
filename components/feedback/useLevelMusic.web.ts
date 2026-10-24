import { useCallback, useEffect, useRef } from 'react';
import { MUSIC, MUSIC_VOLUME } from './music';
import { buffer, play, resume, running } from './webAudio';

/**
 * Web version of useLevelMusic.ts: loops the level's track through Web Audio while the level is open
 * and music is on. Browsers only allow audio after a tap, so it starts on the first tap on the level
 * (prime), or straight away if audio is already unlocked (e.g. moving on from a previous level).
 */
export function useLevelMusic(levelId: string, on: boolean) {
  const track = MUSIC[levelId];
  const stop = useRef<(() => void) | null>(null);
  const wanted = useRef(on);
  wanted.current = on;

  const start = useCallback(async () => {
    if (!track || stop.current || !wanted.current || !running()) return;
    const buf = await buffer(track);
    if (buf && !stop.current && wanted.current) stop.current = play(buf, MUSIC_VOLUME, true);
  }, [track]);

  useEffect(() => {
    if (on) start();
    else { stop.current?.(); stop.current = null; }
  }, [on, start]);

  useEffect(() => () => { stop.current?.(); stop.current = null; }, []);

  return {
    /** Call from a tap: unlocks audio if needed, then starts the track. */
    prime() {
      resume().then(start);
      if (track) buffer(track); // start decoding right away
    },
  };
}
