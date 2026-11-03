import { useCallback, useEffect, useRef } from 'react';
import { useAsmr } from '../settings/Theme';
import { musicReady, trackFor, useMusicTurn, MUSIC_DUCKED, MUSIC_VOLUME, type Track } from './music';
import { audioContext, buffer, generation, onRunning, resume, running } from './webAudio';

/**
 * Web version of useLevelMusic.ts: loops the session's track through Web Audio while a level is open and music is on (ASMR mode has
 * its own track, and toggling it fades from one to the other). One loop for the whole app, held by the level screens that want it, so
 * moving to the next level carries on instead of starting the track again; when the last one lets go it stops after a short grace.
 * Browsers only allow audio after a tap; any tap unlocks it (webAudio.ts), so it starts as the level loads when you came from the
 * level list, otherwise on the first tap.
 *
 * A track with a known loop length (scripts/make-music.mjs) isn't looped as a whole file: an MP3 carries a few milliseconds of
 * encoder padding, which would put a gap in the seam. Instead a fresh copy starts every loop length, scheduled on the audio clock, and
 * the reverb tail at the end of each copy overlaps the start of the next, as the music was written to.
 */
interface Playing { track: Track; gen: number; gain: GainNode; stop: (fade?: number) => void }
let current: Playing | null = null;
let holders = 0;
let stopTimer: ReturnType<typeof setTimeout> | undefined;
let duckedNow = false;
const GRACE_MS = 700;
const FADE = 0.8; // seconds, when switching tracks or stopping

const live = () => !!current && current.gen === generation();

function stopNow(fade = 0) {
  clearTimeout(stopTimer);
  current?.stop(fade);
  current = null;
}

/** Starts a track on the current audio context, through its own gain (for ducking and fades). */
function startLoop(track: Track, buf: AudioBuffer, volume: number): Playing | null {
  const ac = audioContext();
  if (!ac || ac.state !== 'running') return null;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, ac.currentTime);
  gain.gain.linearRampToValueAtTime(volume, ac.currentTime + 0.4);
  gain.connect(ac.destination);
  const sources = new Set<AudioBufferSourceNode>();
  const begin = (when: number, loop: boolean) => {
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    src.connect(gain);
    src.start(when);
    sources.add(src);
    src.onended = () => { sources.delete(src); src.disconnect(); };
  };
  let timer: ReturnType<typeof setInterval> | undefined;
  if (track.loop) {
    // Keep a couple of copies booked ahead on the audio clock; the timer only tops the queue up.
    const L = track.loop;
    let next = ac.currentTime + 0.05;
    const book = () => { while (next < ac.currentTime + 2 * L) { begin(next, false); next += L; } };
    book();
    timer = setInterval(book, 1000);
  } else {
    begin(ac.currentTime, true);
  }
  return {
    track, gen: generation(), gain,
    stop(fade = 0) {
      clearInterval(timer);
      const end = ac.currentTime + fade;
      try {
        gain.gain.cancelScheduledValues(ac.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, ac.currentTime);
        gain.gain.linearRampToValueAtTime(0, end);
      } catch { /* closed context */ }
      for (const s of sources) { try { s.stop(end); } catch { /* not started or already stopped */ } }
      setTimeout(() => { try { gain.disconnect(); } catch { /* gone */ } }, fade * 1000 + 100);
    },
  };
}

export function useLevelMusic(levelId: string, on: boolean, duck = false) {
  const [asmr] = useAsmr();
  // This session's tracks settle a moment after start (each session plays the next one); `start` waits for that, so it has to be a new
  // function once they have, or the effects below never call it again when the track happens to be the same.
  const turnReady = useMusicTurn();
  const track = trackFor(levelId, asmr);
  const holding = useRef(false);
  duckedNow = duck;

  const start = useCallback(async () => {
    if (!holding.current || !running() || !musicReady()) return;
    if (live() && current!.track === track) return;
    const buf = await buffer(track.src);
    if (!buf || !holding.current || !running() || (live() && current!.track === track)) return;
    // A different track playing (ASMR mode toggled) fades out as this one fades in; one left on a replaced context just stops.
    stopNow(live() ? FADE : 0);
    current = startLoop(track, buf, duckedNow ? MUSIC_DUCKED : MUSIC_VOLUME);
  }, [track, turnReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Decode the track right away so starting is instant, and start as soon as audio is unlocked.
  useEffect(() => {
    buffer(track.src);
    return onRunning(start);
  }, [track, start]);

  useEffect(() => {
    if (!on) {
      if (holders === 0) stopNow();
      return;
    }
    holding.current = true;
    holders++;
    clearTimeout(stopTimer);
    start();
    return () => {
      holding.current = false;
      holders--;
      if (holders > 0) return;
      clearTimeout(stopTimer);
      stopTimer = setTimeout(() => { if (holders === 0) stopNow(); }, GRACE_MS);
    };
  }, [on, start]);

  // Dip while the ball flies, with a short glide so it doesn't click.
  useEffect(() => {
    const ac = audioContext();
    if (ac && live()) current!.gain.gain.setTargetAtTime(duck ? MUSIC_DUCKED : MUSIC_VOLUME, ac.currentTime, 0.08);
  }, [duck]);

  return {
    /** Call from a tap: unlocks audio if needed, then starts the track. */
    prime() {
      resume().then(start);
      buffer(track.src); // start decoding right away
    },
  };
}
