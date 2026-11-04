import { useAudioPlayer, useAudioPlaylist } from 'expo-audio';
import { useEffect, useState } from 'react';
import { localSound, setAudioModeOnce, sourceOf } from './localAudio';
import { warmSounds } from './useFeedback';
import { MUSIC_DUCKED, MUSIC_VOLUME, trackFor, useMusicTurn } from './music';
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
  }, [asmr, turnReady]);
  return track == null ? null : <MusicPlayer key={String(track)} source={sourceOf(track)} loop={loop} />;
}

/** About how long the queue of copies runs before it starts over (seconds). */
const QUEUE_SECONDS = 20 * 60;

/**
 * The player itself, made once the track is a file on the phone. The iPhone's player can't loop a file without a gap: at the end it
 * seeks back to the start, and the music stopped for a moment each time round (0.62.2 tried two players taking turns, and players
 * still heard the gap). So the track is played as a playlist of copies of itself (about 20 minutes of them): iOS's queue player
 * readies the next item while one plays and moves on without a gap, the way Apple's own gapless looper works. The phone file is the
 * exact loop (scripts/make-music.mjs), so copy follows copy seamlessly; only when the whole queue starts over can there be one small
 * gap, about every 20 minutes. A track with no known loop length plays as a single looping file.
 */
function MusicPlayer({ source, loop }: { source: number | { uri: string }; loop: number | null }) {
  return loop ? <QueuedMusic source={source} copies={Math.max(2, Math.ceil(QUEUE_SECONDS / loop))} /> : <LoopedMusic source={source} />;
}

/** Plays a player (or playlist) while a level screen wants music, ducked during a shot (musicDemand.ts). */
function useDemand(p: { playing: boolean; volume: number; play(): void; pause(): void }) {
  useEffect(() => {
    const apply = () => {
      const { wanted, ducked } = musicDemand();
      try {
        p.volume = ducked ? MUSIC_DUCKED : MUSIC_VOLUME;
        if (wanted && !p.playing) p.play();
        if (!wanted && p.playing) p.pause();
      } catch {
        // Music is a nicety: never let it break the game.
      }
    };
    apply();
    const off = onMusicDemand(apply);
    return () => { off(); try { p.pause(); } catch { /* released */ } };
  }, [p]);
}

function QueuedMusic({ source, copies }: { source: number | { uri: string }; copies: number }) {
  const [sources] = useState(() => Array.from({ length: copies }, () => source));
  const playlist = useAudioPlaylist({ sources, loop: 'all' });
  useDemand(playlist);
  return null;
}

function LoopedMusic({ source }: { source: number | { uri: string } }) {
  const player = useAudioPlayer(source, { keepAudioSessionActive: true });
  useEffect(() => { try { player.loop = true; } catch { /* not loaded yet */ } }, [player]);
  useDemand(player);
  return null;
}
