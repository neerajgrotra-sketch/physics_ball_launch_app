// The levels come in worlds, one per new idea. Inside a world the toughness rises (tools/assess-levels.ts), and each world's first
// level is its gentle introduction. The level list shows a header at the start of each world. Pure: no UI imports.

export interface World {
  name: string;
  /** One line under the name: what is new here. */
  blurb: string;
  /** Level ids, in play order. */
  ids: string[];
}

export const WORLDS: World[] = [
  {
    name: 'Bars', blurb: 'Place bars to bounce the ball into the glass.',
    ids: ['00-tutorial', '01-first-bounce', '02-two-step', '05-four-millimetres', '03-high-ground', '04-crossfire'],
  },
  {
    name: 'Blocks', blurb: 'Solid walls to bank off.',
    ids: ['07-slalom', '06-roadblock', '08-switchback', '09-gauntlet'],
  },
  {
    name: 'Hazards', blurb: 'Red spikes destroy the ball.',
    ids: ['10-spikes', '17-cushion', '11-moat', '12-stilts', '13-needle', '14-boomerang', '15-penthouse', '16-skyline'],
  },
  {
    name: 'Springs', blurb: 'Gold pads and bars throw the ball back harder.',
    ids: ['25-bounce-house', '18-springboard', '19-pinball', '20-trampoline'],
  },
  {
    name: 'Portals', blurb: 'In one end, out the other.',
    ids: ['21-wormhole', '23-turnstile', '22-slingshot', '24-relay'],
  },
];

/** Every level id in play order, across the worlds. */
export const WORLD_ORDER: string[] = WORLDS.flatMap((w) => w.ids);

/** The world that starts with this level, if it starts one. */
export function worldStartingAt(levelId: string): World | undefined {
  return WORLDS.find((w) => w.ids[0] === levelId);
}
