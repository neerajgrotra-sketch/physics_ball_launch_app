// Background music: one looping track per level. To give a level music, put the file in assets/music
// (MP3 or M4A, ideally a seamless loop under ~1 MB) and add a line here keyed by the level id.
// Levels without an entry play no music.
export const MUSIC: Record<string, number> = {
  '01-first-bounce': require('../../assets/music/01-first-bounce.mp3'),
};

/** Music sits under the effects (bounces, chime), which play at up to full volume. */
export const MUSIC_VOLUME = 0.35;
