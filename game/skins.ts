// Ball skins: how the steel ball looks, picked in Settings and saved on the device. Purely a look: the physics ball is always a circle
// of BALL_RADIUS, so a skin never changes the size, the bounce or any level's answer. Designs that aren't round (the star, the cube)
// fit inside that circle and spin as they fly, so they read as a costume on the same ball. Pure: no UI imports, so Vitest covers it.
// Drawn by components/board/BallArt.tsx.

export const SKIN_KEY = 'bank-shot/ball';

/** How the surface is shaded. */
export type Finish = 'shiny' | 'metal' | 'glass' | 'neon' | 'rainbow';
/** What is drawn on (or instead of) the sphere. */
export type Pattern = 'none' | 'beach' | 'eight' | 'smiley' | 'planet' | 'basket' | 'star' | 'cube';

export interface BallSkin {
  id: string;
  name: string;
  group: 'Colours' | 'Designs';
  /** The main colour, also used wherever the ball is drawn small (level cards, the intro). `null`: the theme's steel. */
  fill: string | null;
  finish: Finish;
  pattern: Pattern;
}

export const SKINS: BallSkin[] = [
  { id: 'steel', name: 'Steel', group: 'Colours', fill: null, finish: 'shiny', pattern: 'none' },
  { id: 'chrome', name: 'Chrome', group: 'Colours', fill: '#d8dee4', finish: 'metal', pattern: 'none' },
  { id: 'gold', name: 'Gold', group: 'Colours', fill: '#e0b030', finish: 'metal', pattern: 'none' },
  { id: 'copper', name: 'Copper', group: 'Colours', fill: '#c4703a', finish: 'metal', pattern: 'none' },
  { id: 'ruby', name: 'Ruby', group: 'Colours', fill: '#d2283c', finish: 'shiny', pattern: 'none' },
  { id: 'mint', name: 'Mint', group: 'Colours', fill: '#4cd6a8', finish: 'shiny', pattern: 'none' },
  { id: 'onyx', name: 'Onyx', group: 'Colours', fill: '#24272b', finish: 'shiny', pattern: 'none' },
  { id: 'glass', name: 'Glass', group: 'Colours', fill: '#bfe6ff', finish: 'glass', pattern: 'none' },
  { id: 'neon', name: 'Neon', group: 'Colours', fill: '#39ff6a', finish: 'neon', pattern: 'none' },
  { id: 'rainbow', name: 'Rainbow', group: 'Colours', fill: '#ff6ad5', finish: 'rainbow', pattern: 'none' },
  { id: 'beach', name: 'Beach ball', group: 'Designs', fill: '#ff5a4e', finish: 'shiny', pattern: 'beach' },
  { id: 'eight', name: '8-ball', group: 'Designs', fill: '#16181a', finish: 'shiny', pattern: 'eight' },
  { id: 'smiley', name: 'Smiley', group: 'Designs', fill: '#ffd23f', finish: 'shiny', pattern: 'smiley' },
  { id: 'planet', name: 'Planet', group: 'Designs', fill: '#3f8fd8', finish: 'shiny', pattern: 'planet' },
  { id: 'basket', name: 'Basketball', group: 'Designs', fill: '#ee7f22', finish: 'shiny', pattern: 'basket' },
  { id: 'star', name: 'Star', group: 'Designs', fill: '#ffc933', finish: 'shiny', pattern: 'star' },
  { id: 'cube', name: 'Cube', group: 'Designs', fill: '#8a6cff', finish: 'shiny', pattern: 'cube' },
];

export const DEFAULT_SKIN = SKINS[0];

/** The saved choice, or the default when nothing (or something unknown) is saved. */
export function parseSkin(raw: string | null | undefined): BallSkin {
  return SKINS.find((s) => s.id === raw) ?? DEFAULT_SKIN;
}

export function skinById(id: string): BallSkin {
  return parseSkin(id);
}

/** The skin's main colour, with the theme's steel for the default ball. */
export function skinFill(skin: BallSkin, steel: string): string {
  return skin.fill ?? steel;
}

/** A colour made lighter (k > 0, towards white) or darker (k < 0, towards black), for metal shading. `#rrggbb` in and out. */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)));
  return `#${ch.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * How far the ball has turned (radians, clockwise positive) at each point of a path: it rolls with its travel, so moving right turns it
 * clockwise and moving left turns it back. Used to spin the designs as they fly, and to leave a resting ball at the turn it ended on.
 */
export function spinAlong(path: [number, number][], radius: number): number[] {
  const out = new Array<number>(path.length);
  let a = 0;
  for (let i = 0; i < path.length; i++) {
    if (i > 0) {
      const dx = path[i][0] - path[i - 1][0], dy = path[i][1] - path[i - 1][1];
      const d = Math.hypot(dx, dy);
      // A jump through a portal is not travel.
      if (d < 4 * radius) a += (dx >= 0 ? d : -d) / radius;
    }
    out[i] = a;
  }
  return out;
}
