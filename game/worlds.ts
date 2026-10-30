// The levels come in worlds, one per new idea. Inside a world the toughness rises (tools/assess-levels.ts), and each world's first
// level is its gentle introduction. The level list shows a header at the start of each world, with an ⓘ that opens the world's
// info card (components/levels/WorldInfo.tsx). Pure: no UI imports.
import { isSpring, type Level } from '../physics';

/** Something a world brings in, drawn on its info card (components/levels/WorldInfo.tsx) the way it looks on the board. */
export type FeatureKind = 'bar' | 'glass' | 'block' | 'spikedblock' | 'hazard' | 'pad' | 'springbar' | 'portal';
export interface Feature { kind: FeatureKind; name: string; text: string }

export interface World {
  name: string;
  /** One line under the name: what is new here. */
  blurb: string;
  /** Level ids, in play order. */
  ids: string[];
  /** The world's info card (the ⓘ on its header): a big line, a short pitch, what you'll meet, and a pro tip. */
  tagline: string;
  pitch: string;
  features: Feature[];
  tip: string;
}

export const WORLDS: World[] = [
  {
    name: 'Bars', blurb: 'Place bars to bounce the ball into the glass.',
    ids: ['00-tutorial', '01-first-bounce', '02-two-step', '05-four-millimetres', '03-high-ground', '04-crossfire'],
    tagline: 'Every great trick shot starts here.',
    pitch: 'One cannon, one glass, and a handful of bars you can put anywhere. Bank the ball off every bar and drop it in.',
    features: [
      { kind: 'bar', name: 'Your bars', text: 'Drag, slide and spin them anywhere. A win has to bounce off every one.' },
      { kind: 'glass', name: 'The glass', text: 'Barely wider than the ball. Land it and keep it there.' },
    ],
    tip: 'Work backwards: line up the last bar to drop the ball into the glass, then find a way to reach that bar.',
  },
  {
    name: 'Blocks', blurb: 'Solid walls to bank off.',
    ids: ['07-slalom', '06-roadblock', '08-switchback', '09-gauntlet'],
    tagline: 'Walls in the way? Use them.',
    pitch: 'Grey blocks stand between you and the glass. The ball bounces off them softly, so a good banker turns a wall into a free bounce.',
    features: [
      { kind: 'block', name: 'Blocks', text: 'Solid and safe. They soak up a little speed on every bounce.' },
    ],
    tip: 'A wall right next to the glass makes a perfect backboard. Aim past the glass and let the wall drop it in.',
  },
  {
    name: 'Hazards', blurb: 'Red spikes destroy the ball.',
    ids: ['10-spikes', '17-cushion', '11-moat', '12-stilts', '13-needle', '14-boomerang', '15-penthouse', '16-skyline'],
    tagline: "Don't touch the red.",
    pitch: 'Spikes guard the glass now. One touch, even a spike tip, and the ball bursts. Thread the needle.',
    features: [
      { kind: 'hazard', name: 'Spikes', text: 'Touch one and the shot is over. The tips count too.' },
      { kind: 'spikedblock', name: 'Spiked walls', text: 'Some walls have spikes on one side only: bank off the safe side.' },
    ],
    tip: 'Watch your misses: the ghost trails show exactly where a shot clipped a spike.',
  },
  {
    name: 'Springs', blurb: 'Gold pads and bars throw the ball back harder.',
    ids: ['25-bounce-house', '18-springboard', '19-pinball', '20-trampoline'],
    tagline: 'Boing.',
    pitch: 'Gold means extra bounce. Springs fling the ball back faster than it came, so a gentle shot can fly across the board.',
    features: [
      { kind: 'pad', name: 'Spring pads', text: 'Throw the ball back harder, with a kick. A win needs every pad touched.' },
      { kind: 'springbar', name: 'Spring bars', text: 'A gold bar of your own that bounces like a trampoline.' },
    ],
    tip: 'Springs add speed. Try less power than feels right: let the pad do the work.',
  },
  {
    name: 'Portals', blurb: 'In one end, out the other.',
    ids: ['21-wormhole', '23-turnstile', '22-slingshot', '24-relay'],
    tagline: 'Now you see it.',
    pitch: 'In one ring, out of its partner. The ball keeps its speed through a portal, and some portals turn it as it comes out.',
    features: [
      { kind: 'portal', name: 'Portals', text: 'Blue and orange rings are linked: in one, out the other, at the same speed. A win needs every pair used.' },
    ],
    tip: 'Watch which way the ball leaves the far ring, then build your bars from there.',
  },
];

/** Every level id in play order, across the worlds. */
export const WORLD_ORDER: string[] = WORLDS.flatMap((w) => w.ids);

/** The world that starts with this level, if it starts one. */
export function worldStartingAt(levelId: string): World | undefined {
  return WORLDS.find((w) => w.ids[0] === levelId);
}

/** The world a level belongs to. */
export function worldOf(levelId: string): World | undefined {
  return WORLDS.find((w) => w.ids.includes(levelId));
}

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What's on a level, in a few words for its card ("3 bars · 2 spikes · 1 portal"), so a locked level still tempts. */
export function levelContents(level: Level): string {
  const springs = level.pieces.filter((p) => isSpring(p.restitution)).length;
  const bars = level.pieces.length - springs;
  const parts = [
    bars > 0 && count(bars, 'bar'),
    springs > 0 && count(springs, 'spring bar'),
    level.blocks?.length && count(level.blocks.length, 'block'),
    level.hazards?.length && count(level.hazards.length, 'spike', 'spikes'),
    level.pads?.length && count(level.pads.length, 'pad'),
    level.portals?.length && count(level.portals.length, 'portal'),
  ];
  return parts.filter(Boolean).join(' · ');
}
