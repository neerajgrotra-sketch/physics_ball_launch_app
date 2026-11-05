import { alog } from './audioLog';
import { useEffect, useRef } from 'react';
import { useSoundSettings } from './SoundSettings';
import { holdMusic, musicOffNow, setMusicDucked } from './musicDemand';
import { musicLevelOpened } from './music';

/**
 * A level screen's music: holds the app's one music player (MusicHost, in the root layout) while the level is open and music is on,
 * and dips it while the ball flies. Moving to the next level keeps it playing; leaving the levels stops it. Web uses
 * useLevelMusic.web.ts. `prime` is for web's user-gesture rule; nothing to do here.
 */
export function useLevelMusic(levelId: string, on: boolean, duck = false) {
  // Mix moves on to the next track when a different level opens (music.ts musicLevelOpened).
  useEffect(() => { if (on) musicLevelOpened(levelId); }, [levelId, on]);
  const { musicOn } = useSoundSettings();
  useEffect(() => {
    // Only switching the music off stops it at once. A screen that merely stops wanting it (it lost focus because the next one is
    // opening) has already let go, with the usual grace: stopping at once here cut the music for a moment between the level list
    // and a level, and started it again from the top.
    if (!on) { if (!musicOn) { alog(`music: switched off (${levelId})`); musicOffNow(); } return; }
    alog(`music: ${levelId} wants it`);
    const release = holdMusic();
    return () => { alog(`music: ${levelId} lets go`); release(); };
  }, [on, musicOn]);

  const dipped = useRef(false);
  useEffect(() => {
    if (duck !== dipped.current) alog(duck ? `music: dipped for a shot (${levelId})` : `music: back up after the shot (${levelId})`);
    dipped.current = duck;
    setMusicDucked(duck);
  }, [duck]);

  return { prime() {} };
}
