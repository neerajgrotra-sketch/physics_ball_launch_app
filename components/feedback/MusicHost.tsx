import { useAudioPlayer } from 'expo-audio';
import { useEffect, useState } from 'react';
import { localSound, setAudioModeOnce, sourceOf } from './localAudio';
import { warmSounds } from './useFeedback';
import { loadMusicLevel, musicVolume, onMusicLevel, trackFor, useMusicPick, useMusicTurn } from './music';
import { musicDemand, onMusicDemand } from './musicDemand';
import { useAsmr } from '../settings/Theme';

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
  // ASMR mode has its own track ("Neon Drift"); toggling it swaps the player for that mode's track.
  const [asmr] = useAsmr();
  const turnReady = useMusicTurn(); // this session's tracks (each session plays the next one)
  const pick = useMusicPick(asmr); // or the player's own pick (Settings), which switches the track at once
  const [track, setTrack] = useState<string | number | null>(null);
  const [loop, setLoop] = useState<number | null>(null);
  useEffect(() => {
    setAudioModeOnce();
    warmSounds().catch(() => {});
  }, []);
  useEffect(() => {
    if (!turnReady) return;
    let live = true;
    const t = trackFor('', asmr);
    localSound(t.src).then((f) => { if (live) { setLoop(t.loop); setTrack(f); } });
    return () => { live = false; };
  }, [asmr, turnReady, pick]);
  return track == null ? null : <MusicPlayer key={String(track)} source={sourceOf(track)} loop={loop} />;
}

/**
 * The player itself, made once the track is a file on the phone. The iPhone's player stalls for a moment whenever it sets a file up:
 * at a loop (it seeks back to the start), on handing over to a second player (0.62.2), and as a queue readies its next copy (0.62.3,
 * a pause 2 to 3 s after the music started). So phones play one long file (assets/music/long/*.m4a, scripts/make-playlist.mjs): the
 * loop repeated, seamlessly, for about ten minutes. One player, one file, nothing set up mid-track; it only loops at the end.
 */
function MusicPlayer({ source }: { source: number | { uri: string }; loop: number | null }) {
  return <LoopedMusic source={source} />;
}

/** Plays the player while a level screen wants music, ducked during a shot (musicDemand.ts). */
function useDemand(p: { playing: boolean; volume: number; play(): void; pause(): void }) {
  useEffect(() => {
    const apply = () => {
      const { wanted, ducked } = musicDemand();
      try {
        p.volume = musicVolume(ducked);
        if (wanted && !p.playing) p.play();
        if (!wanted && p.playing) p.pause();
      } catch {
        // Music is a nicety: never let it break the game.
      }
    };
    apply();
    const off = onMusicDemand(apply);
    const offLevel = onMusicLevel(apply); // the player's own volume (Settings)
    loadMusicLevel().then(apply);
    return () => { off(); offLevel(); try { p.pause(); } catch { /* released */ } };
  }, [p]);
}

function LoopedMusic({ source }: { source: number | { uri: string } }) {
  const player = useAudioPlayer(source, { keepAudioSessionActive: true });
  useEffect(() => { try { player.loop = true; } catch { /* not loaded yet */ } }, [player]);
  useDemand(player);
  return null;
}
