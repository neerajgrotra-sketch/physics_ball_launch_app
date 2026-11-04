import { useAudioPlayer } from 'expo-audio';
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

/** How long the two players overlap at the loop point (seconds), and how often the playing one is checked. */
const XFADE = 0.25;
const TICK_MS = 50;

/**
 * The player itself, made once the track is a file on the phone. The iPhone's player can't loop without a gap (at the end it seeks
 * back to the start, and the music stopped for a moment each time round). So there are two players of the same file, taking turns:
 * the file is the loop plus a copy of its first 2 s (scripts/make-music.mjs), and when the playing one reaches the loop point the
 * other starts from the matching spot just past the start, the two cross-fading over XFADE while the first plays on into its copy
 * of the start. A track with no known loop length just loops the whole file.
 */
function MusicPlayer({ source, loop }: { source: number | { uri: string }; loop: number | null }) {
  const a = useAudioPlayer(source, { keepAudioSessionActive: true });
  const b = useAudioPlayer(source, { keepAudioSessionActive: true });

  useEffect(() => {
    const players = [a, b];
    let active = 0;            // which player is carrying the music
    let fade: { from: number; started: number } | null = null; // a cross-fade in progress (from = the outgoing player)
    let switching = false;
    const target = () => (musicDemand().ducked ? MUSIC_DUCKED : MUSIC_VOLUME);
    const safe = (f: () => void) => { try { f(); } catch { /* released, or not loaded yet */ } };

    const apply = () => {
      const { wanted } = musicDemand();
      safe(() => {
        const p = players[active];
        if (!loop) p.loop = true;
        if (!fade) p.volume = target();
        if (wanted && !p.playing) p.play();
        if (!wanted) players.forEach((q) => q.playing && q.pause());
      });
    };

    const tick = async () => {
      if (!loop || !musicDemand().wanted) return;
      const p = players[active], q = players[1 - active];
      if (fade) {
        // Cross-fade: the incoming one rises as the outgoing one falls; then the outgoing one stops and waits at the start.
        const k = Math.min(1, (Date.now() - fade.started) / (XFADE * 1000));
        safe(() => { players[fade!.from].volume = target() * (1 - k); p.volume = target() * k; });
        if (k >= 1) {
          const old = players[fade.from];
          fade = null;
          safe(() => old.pause());
          old.seekTo(0).catch(() => {});
        }
        return;
      }
      // Ran past the loop point without switching (the app was in the background, say) and stopped at the end of its file: carry on
      // from the matching spot near the start.
      if (!switching && !p.playing && p.currentTime >= loop) {
        switching = true;
        await p.seekTo(Math.max(0, p.currentTime - loop)).catch(() => {});
        safe(() => { p.volume = target(); p.play(); });
        switching = false;
        return;
      }
      if (switching || !p.playing || p.currentTime < loop) return;
      // At the loop point: start the other one where the music now is (just past the start), and fade across.
      switching = true;
      const at = Math.max(0, p.currentTime - loop + 0.03);
      try {
        await q.seekTo(at);
        safe(() => { q.volume = 0; q.play(); });
        fade = { from: active, started: Date.now() };
        active = 1 - active;
      } catch {
        // If the other player couldn't take over, the playing one just carries on into its copy of the start.
      }
      switching = false;
    };

    apply();
    const off = onMusicDemand(apply);
    const timer = setInterval(tick, TICK_MS);
    return () => {
      off();
      clearInterval(timer);
      players.forEach((q) => safe(() => q.pause()));
    };
  }, [a, b, loop]);

  return null;
}
