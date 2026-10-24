import { useAudioPlayer } from 'expo-audio';
import { useEffect } from 'react';
import { MUSIC, MUSIC_VOLUME } from './music';

/**
 * Loops the level's track while the level screen is open and music is on; stops when leaving the
 * level. Follows the silent switch and mixes with other audio (audio mode set in useFeedback.ts).
 * Web uses useLevelMusic.web.ts. `prime` is for web\'s user-gesture rule; nothing to do here.
 */
export function useLevelMusic(levelId: string, on: boolean) {
  const track = MUSIC[levelId];
  const player = useAudioPlayer(track ?? null);

  useEffect(() => {
    if (!track) return;
    try {
      player.loop = true;
      player.volume = MUSIC_VOLUME;
      if (on) player.play();
      else player.pause();
    } catch {
      // Music is a nicety: never let it break the game.
    }
    return () => {
      try { player.pause(); } catch { /* player already released */ }
    };
  }, [player, track, on]);

  return { prime() {} };
}
