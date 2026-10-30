import { useAudioPlayer } from 'expo-audio';
import { useEffect, useState } from 'react';
import { localSound, setAudioModeOnce, sourceOf } from './localAudio';
import { warmSounds } from './useFeedback';
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
  // The track is played from a file on the phone (localAudio.ts): in Expo Go the bundled one is a stream from the PC, which stalled.
  // No player exists until that file is ready; the music simply starts a moment later. The effects are got ready at the same time.
  const [track, setTrack] = useState<string | number | null>(null);
  useEffect(() => {
    let live = true;
    setAudioModeOnce();
    warmSounds().catch(() => {});
    localSound(trackFor('')).then((f) => { if (live) setTrack(f); });
    return () => { live = false; };
  }, []);
  return track == null ? null : <MusicPlayer source={sourceOf(track)} />;
}

/** The player itself, made once the track is a file on the phone. */
function MusicPlayer({ source }: { source: number | { uri: string } }) {
  const player = useAudioPlayer(source, { keepAudioSessionActive: true });

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
