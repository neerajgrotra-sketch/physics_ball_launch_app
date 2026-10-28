import { useEffect } from 'react';
import { holdMusic, musicOffNow, setMusicDucked } from './musicDemand';

/**
 * A level screen's music: holds the app's one music player (MusicHost, in the root layout) while the level is open and music is on,
 * and dips it while the ball flies. Moving to the next level keeps it playing; leaving the levels stops it. Web uses
 * useLevelMusic.web.ts. `prime` is for web's user-gesture rule; nothing to do here.
 */
export function useLevelMusic(_levelId: string, on: boolean, duck = false) {
  useEffect(() => {
    if (!on) { musicOffNow(); return; }
    return holdMusic();
  }, [on]);

  useEffect(() => { setMusicDucked(duck); }, [duck]);

  return { prime() {} };
}
