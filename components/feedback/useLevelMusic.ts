import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useEffect } from 'react';
import { trackFor, MUSIC_DUCKED, MUSIC_VOLUME } from './music';

/**
 * One music player for the whole app, so moving from one level to the next doesn't stop the track and start it again (each level
 * screen used to make its own player, and the music broke off at every level change). Level screens that want music hold it; when
 * the last one lets go it pauses, after a short grace so the next level picking it up keeps it playing without a gap.
 */
let shared: { player: AudioPlayer; track: number } | null = null;
let holders = 0;
let pauseTimer: ReturnType<typeof setTimeout> | undefined;
const GRACE_MS = 700;

function playerFor(track: number): AudioPlayer {
  if (!shared || shared.track !== track) {
    try { shared?.player.remove(); } catch { /* already gone */ }
    shared = { player: createAudioPlayer(track, { keepAudioSessionActive: true }), track }; // pausing doesn't shut the audio session down
    shared.player.loop = true;
  }
  return shared.player;
}

/**
 * Loops the session's track while a level screen is open and music is on; pauses once no level wants it. Follows the silent
 * switch and mixes with other audio (audio mode set in useFeedback.ts). Web uses useLevelMusic.web.ts. `prime` is for web's
 * user-gesture rule; nothing to do here.
 */
export function useLevelMusic(levelId: string, on: boolean, duck = false) {
  const track = trackFor(levelId);

  useEffect(() => {
    if (!track) return;
    if (!on) {
      // Music switched off (or this level is covered by another screen): stop now, not after the grace.
      if (holders === 0) { clearTimeout(pauseTimer); try { shared?.player.pause(); } catch { /* released */ } }
      return;
    }
    holders++;
    clearTimeout(pauseTimer);
    try {
      const player = playerFor(track);
      player.loop = true;
      if (!player.playing) player.play();
    } catch {
      // Music is a nicety: never let it break the game.
    }
    return () => {
      holders--;
      if (holders > 0) return;
      clearTimeout(pauseTimer);
      pauseTimer = setTimeout(() => {
        if (holders === 0) try { shared?.player.pause(); } catch { /* released */ }
      }, GRACE_MS);
    };
  }, [track, on]);

  useEffect(() => {
    if (!track || !on) return;
    try { playerFor(track).volume = duck ? MUSIC_DUCKED : MUSIC_VOLUME; } catch { /* released */ }
  }, [track, on, duck]);

  return { prime() {} };
}
