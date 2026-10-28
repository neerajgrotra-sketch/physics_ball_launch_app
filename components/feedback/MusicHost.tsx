import { useAudioPlayer } from 'expo-audio';
import { useEffect } from 'react';
import { MUSIC_DUCKED, MUSIC_VOLUME, trackFor } from './music';
import { musicDemand, onMusicDemand } from './musicDemand';

/**
 * The app's one music player, mounted once in the root layout and never again, so the music runs on across levels. React owns
 * the player (useAudioPlayer releases it when this unmounts, including on a development reload), so it can never be left playing
 * on its own: 0.39 kept the player in a module variable, and a reload of that file left the old one playing beside a new one (two
 * tracks at once, and the Music switch only reached one). It plays while a level screen wants music (musicDemand.ts).
 * Renders nothing. Web plays music through Web Audio instead (MusicHost.web.tsx, useLevelMusic.web.ts).
 */
export function MusicHost() {
  const player = useAudioPlayer(trackFor(''), { keepAudioSessionActive: true });

  useEffect(() => {
    const apply = () => {
      const { wanted, ducked } = musicDemand();
      try {
        player.loop = true;
        player.volume = ducked ? MUSIC_DUCKED : MUSIC_VOLUME;
        if (wanted && !player.playing) player.play();
        if (!wanted && player.playing) player.pause();
      } catch {
        // Music is a nicety: never let it break the game.
      }
    };
    apply();
    const off = onMusicDemand(apply);
    return () => { off(); try { player.pause(); } catch { /* released */ } };
  }, [player]);

  return null;
}
