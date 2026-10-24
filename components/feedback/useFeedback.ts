import { setAudioModeAsync, useAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import type { Hit } from '../../physics';

// Sounds come from scripts/make-sounds.mjs. Re-run it to change them.
const SOUNDS = {
  launch: require('../../assets/sounds/launch.wav'),
  wall: require('../../assets/sounds/wall.wav'),
  bounce: require('../../assets/sounds/bounce.wav'),
  glass: require('../../assets/sounds/glass.wav'),
  land: require('../../assets/sounds/land.wav'),
  dead: require('../../assets/sounds/dead.wav'),
};

/** Bounce speed (px/s) that counts as a full-strength hit. Launches top out at 1120. */
const HARD_HIT = 700;

/**
 * Haptics and sound for a shot: a thunk and whoosh at launch; on each bounce a tap plus a metallic tink
 * off a bar, a dull tok off the floor or an edge, or a clink off the glass (stronger and louder when
 * faster); a success buzz and chime when the ball settles in the glass; a soft thump on a dead surface.
 * Sounds follow the silent switch and mix with whatever else is playing.
 */
export function useFeedback() {
  const launch = useAudioPlayer(SOUNDS.launch);
  const wall = useAudioPlayer(SOUNDS.wall);
  const bounce = useAudioPlayer(SOUNDS.bounce);
  const glass = useAudioPlayer(SOUNDS.glass);
  const land = useAudioPlayer(SOUNDS.land);
  const dead = useAudioPlayer(SOUNDS.dead);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
  }, []);

  return {
    /** Web needs a user gesture to start audio (see useFeedback.web.ts); nothing to do here. */
    prime() {},
    launched() {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      play(launch, 0.8);
    },
    hit(h: Hit) {
      const strength = Math.max(0.2, Math.min(1, h.speed / HARD_HIT));
      const style = h.kind === 'piece' && strength > 0.6
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light;
      Haptics.impactAsync(style).catch(() => {});
      if (h.kind === 'glass') play(glass, strength);
      else if (h.kind === 'wall') play(wall, strength * 0.8);
      else play(bounce, strength);
    },
    landed() {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      play(land, 1);
    },
    died() {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
      play(dead, 0.7);
    },
  };
}

/** Restart a short effect from the top, so quick repeats retrigger instead of being dropped. */
function play(player: AudioPlayer, volume: number) {
  try {
    player.volume = volume;
    player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    // Audio is a nicety: never let it break a shot.
  }
}
