// The guided tour: a few screens between the intro and the first level that explain what the game is, how to win, how the controls work,
// what the board pieces are, and where to get help, ending with a hand-off to the tutorial level. Pure content: no UI imports, so a test
// can check it. Each page's picture is a short scene played on the real board (components/tour/TourScene.tsx, scripts in scenes.ts):
// real levels, real simulate() shots and their sounds, with a ghost finger doing the dragging.

import { WORLD, type Level } from '../physics';

export type TourPicture = 'welcome' | 'goal' | 'aim' | 'bars' | 'stars' | 'pieces' | 'help' | 'ready';

export interface TourPage {
  picture: TourPicture;
  /** A small label over the title. */
  kicker: string;
  title: string;
  body: string;
  /** Short bullet points under the body (optional). */
  points?: string[];
}

export const TOUR: TourPage[] = [
  {
    picture: 'welcome', kicker: 'Welcome to Bank Shot{, name}', title: 'A game of precision',
    body: 'Every bounce is real physics. Set the shot just right and the ball does exactly the same thing every time, so each try teaches you the next.',
  },
  {
    picture: 'goal', kicker: 'The goal', title: 'Bounce it into the glass',
    body: 'Fire the steel ball from the cannon so it ends up resting in the red glass.',
    points: ['It has to bounce off every bar you are given', 'Walls, floor and blocks bounce too', 'Your last few shots stay on screen as faint trails'],
  },
  {
    picture: 'aim', kicker: 'Aiming', title: 'Angle and power',
    body: 'Drag out from the cannon: the direction sets the angle and the distance sets the power. The dotted line shows where the ball starts to fly.',
    points: ['Angle and Power sliders for fine control', '− and + nudge by the smallest step', 'Tap the cannon chip to come back to aiming'],
  },
  {
    picture: 'bars', kicker: 'Your bars', title: 'Place, slide, turn',
    body: 'Tap a bar chip to put that bar on the board, then make the ball bounce where you want.',
    points: ['Drag a bar, or its arrow grips, to move it', 'Drag the round handle to turn it', 'Tap the red bin to remove a bar; Undo puts it back'],
  },
  {
    picture: 'stars', kicker: 'Scoring', title: 'Fewer bounces, more stars',
    body: 'Each level has a par: the fewest bounces we found. Land in that many or fewer for three stars.',
    points: ['★★★ at par or better', '★★ within two of par', 'Every win unlocks the next level'],
  },
  {
    picture: 'pieces', kicker: 'What you will meet', title: 'Five worlds of tricks',
    body: 'Each world adds something new to bounce off, avoid or use.',
    points: ['Grey blocks: walls to bank off', 'Red spikes: they destroy the ball', 'Gold springs: they throw the ball back harder', 'Portals: in the blue, out of the orange'],
  },
  {
    picture: 'help', kicker: 'Stuck{, name}?', title: 'Help is one tap away',
    body: 'Tap Solve for a hint, which places the next bar for you, or for the whole answer. A win with help still opens the next level.',
    points: ['Replay shows your winning shot again', 'Clear wipes the old trails'],
  },
  {
    picture: 'ready', kicker: 'Ready{, name}?', title: 'Learn the ropes',
    body: 'The next level is a guided one: a hand shows you each control, step by step, and waits for you to do it. Then the real levels begin.',
  },
];

/**
 * Put the player's name into a tour line: `{, name}` becomes `, Sam` (or nothing when there is no name), and `{name}` becomes the name
 * (or `there`). Only the first name is used, at most 20 characters, so a line never overflows.
 */
export function withName(text: string, name: string): string {
  const n = (name.trim().split(/\s+/)[0] ?? '').slice(0, 20); // first name only: it is a greeting
  return text.replace('{, name}', n ? `, ${n}` : '').replace('{name}', n || 'there');
}

/** The scenes show the lower part of the board, from this world y down to the bottom (400 × 360), where every scene's shot stays. */
export const TOUR_VIEW_TOP = 200;
export const TOUR_VIEW = { top: TOUR_VIEW_TOP, width: WORLD.width, height: WORLD.height - TOUR_VIEW_TOP };

/**
 * Which level each scene plays on (by id). Shots are the level's stored solution unless a scene says otherwise; tests check that every
 * shot a scene fires lands (or misses, for `miss`) without leaving the view.
 */
export const TOUR_SCENES = {
  welcome: { level: '05-four-millimetres' },
  /** A first try at this power misses Bar 1 (a faint trail), then the stored answer goes in. */
  goal: { level: '02-two-step', miss: { power: 57 } },
  aim: { level: '01-first-bounce' },
  /** Bar 1 is placed, dragged, slid on both arms and turned to the answer's spot, drawn at -28° (the same line as the answer's 152°). */
  bars: { level: '01-first-bounce', drop: { x: 130, y: 330 }, turnTo: -28 },
  stars: { level: '02-two-step' },
  help: { level: '00-tutorial' },
  /** The tutorial's guide: Bar 1 is dragged onto its dashed outline and turned to match (-40° is the same line as the answer's 140°). */
  ready: { level: '00-tutorial', drop: { x: 230, y: 320 }, turnTo: -40 },
} as const;

const demo = (id: string, extra: Partial<Level>, glassX: number): Level =>
  ({ id: `tour-${id}`, name: id, hint: '', fixed: [], pieces: [], glass: { x: glassX, w: 46, h: 54 }, ...extra });

/**
 * The pieces page: one small board per world's piece, each with a shot (found by a search for forgiving inputs, checked by a test) that
 * shows what the piece does: bank off a block into the glass, die on spikes, get thrown by a spring, go through a portal.
 */
export const PIECE_DEMOS: { note: string; level: Level; angle: number; power: number; shows: 'block' | 'dead' | 'pad' | 'portal' }[] = [
  { note: 'Blocks: bank off them', shows: 'block', angle: 51, power: 30, level: demo('blocks', { blocks: [{ x: 250, y: 430, w: 30, h: 220 }] }, 150) },
  {
    note: 'Spikes: they destroy the ball', shows: 'dead', angle: 80.5, power: 53.5,
    level: demo('spikes', { blocks: [{ x: 200, y: 500, w: 60, h: 80 }], hazards: [{ x: 200, y: 456, w: 60, h: 8 }] }, 330),
  },
  { note: 'Springs: they throw it back harder', shows: 'pad', angle: 23, power: 11.5, level: demo('springs', { pads: [{ x: 170, y: 534, w: 80, h: 12 }] }, 330) },
  {
    note: 'Portals: in the blue, out of the orange', shows: 'portal', angle: 75.5, power: 31.5,
    level: demo('portals', { portals: [{ a: { x: 160, y: 380 }, b: { x: 260, y: 300 } }] }, 340),
  },
];
