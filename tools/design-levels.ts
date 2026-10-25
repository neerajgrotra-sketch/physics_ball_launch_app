// Level source of truth. Run: npx tsx tools/design-levels.ts [id-prefix]
// For each design it checks no shot wins without bars, finds a solution that bounces off every bar
// the level gives (so the level is solvable with them all), and writes levels/*.json.
import fs from 'node:fs';
import { type Level } from '../physics';
import { findDirectShot } from './verify-direct';
import { findSolution } from './find-solution';

// Glass: x is its centre, w its inside width (the ball is 16 across), h its height, base the y of its
// floor (default: the floor, WORLD.ground). A raised glass stands on its plate in mid-air.
const designs: Omit<Level, 'solution' | 'par'>[] = [
  // The tutorial (components/coach, game/tutorial.ts): three bars and a roomy glass, played once with a guide that
  // leads the player to this level's stored solution.
  { id: '00-tutorial', name: 'Learn the ropes', glass: { x: 300, w: 46, h: 54 }, fixed: [], pieces: [{ len: 90 }, { len: 90 }, { len: 90 }],
    hint: 'Follow the guide: place the three bars, line them up, set the aim and launch.' },
  { id: '06-roadblock', name: 'Roadblock', glass: { x: 290, w: 40, h: 52 }, fixed: [], pieces: [{ len: 90 }, { len: 90 }],
    blocks: [{ x: 215, y: 395, w: 30, h: 290 }],
    hint: 'A wall stands between you and the glass, which is tucked right behind it. The ball has to drop in from above, and still touch both bars.' },
  { id: '07-slalom', name: 'Slalom', glass: { x: 345, w: 40, h: 52 }, fixed: [], pieces: [{ len: 90 }, { len: 90 }],
    blocks: [{ x: 150, y: 420, w: 30, h: 240 }, { x: 270, y: 130, w: 30, h: 260 }],
    hint: 'A wall from the floor and one from the ceiling: thread the ball between them, using both bars.' },
  { id: '08-switchback', name: 'Switchback', glass: { x: 340, w: 40, h: 52 }, fixed: [], pieces: [{ len: 90 }, { len: 70 }, { len: 70 }],
    blocks: [{ x: 160, y: 440, w: 28, h: 200 }, { x: 265, y: 210, w: 130, h: 22, deg: 25 }],
    hint: 'A wall, and a slanted block overhead that bounces too. Three bars, and the block can help you.' },
  { id: '09-gauntlet', name: 'Gauntlet', glass: { x: 285, w: 40, h: 52 }, fixed: [], pieces: [{ len: 90 }, { len: 70 }, { len: 70 }, { len: 60 }],
    blocks: [{ x: 130, y: 450, w: 28, h: 180 }, { x: 230, y: 150, w: 28, h: 300 }, { x: 335, y: 460, w: 28, h: 160 }],
    hint: 'Three blocks and four bars. The glass sits in a pit: get past the first wall, under the hanging block, then drop in from above.' },
  { id: '10-spikes', name: 'Spikes', glass: { x: 330, w: 40, h: 52 }, fixed: [], pieces: [{ len: 90 }, { len: 70 }, { len: 70 }],
    blocks: [{ x: 130, y: 450, w: 24, h: 180 }],
    hazards: [{ x: 205, y: 528, w: 110, h: 24 }, { x: 250, y: 22, w: 200, h: 24 }],
    hint: 'Red spikes destroy the ball. The floor and the ceiling are not safe: lob it over the wall, between the spikes, using all three bars.' },
  { id: '11-moat', name: 'Moat', glass: { x: 330, w: 40, h: 52 }, fixed: [], pieces: [{ len: 90 }, { len: 70 }, { len: 70 }],
    blocks: [{ x: 125, y: 450, w: 24, h: 180 }],
    hazards: [{ x: 215, y: 105, w: 26, h: 210 }, { x: 272, y: 528, w: 36, h: 24 }, { x: 384, y: 528, w: 28, h: 24 }],
    hint: 'Spikes guard the glass on both sides, and one hangs from the ceiling. Clear the wall, stay under the hanging spikes, and drop straight in.' },
  { id: '12-stilts', name: 'Stilts', glass: { x: 325, w: 38, h: 52, base: 350 }, fixed: [], pieces: [{ len: 90 }, { len: 70 }, { len: 70 }],
    blocks: [{ x: 130, y: 450, w: 24, h: 180 }],
    hazards: [{ x: 325, y: 528, w: 120, h: 24 }],
    hint: 'The glass is up on tall stilts over a bed of spikes. Clear the wall, use all three bars, and do not fall short.' },
  { id: '01-first-bounce', name: 'First bounce', glass: { x: 300, w: 40, h: 50 }, fixed: [], pieces: [{ len: 90 }],
    hint: 'Place the bar, then aim. The ball has to bounce off the bar on its way into the glass.' },
  { id: '02-two-step', name: 'Two step', glass: { x: 130, w: 36, h: 52 }, fixed: [], pieces: [{ len: 90 }, { len: 90 }],
    hint: 'Two bars. The ball has to bounce off both before it lands.' },
  { id: '03-high-ground', name: 'High ground', glass: { x: 320, w: 34, h: 50, base: 380 }, fixed: [], pieces: [{ len: 90 }, { len: 70 }, { len: 70 }],
    hint: 'The glass floats on its plate. Bounce off all three bars; the walls bounce too.' },
  { id: '04-crossfire', name: 'Crossfire', glass: { x: 190, w: 30, h: 54, base: 300 }, fixed: [], pieces: [{ len: 90 }, { len: 70 }, { len: 70 }],
    hint: 'High and in the middle. Every bar has to be part of the shot.' },
  { id: '05-four-millimetres', name: 'Four millimetres', glass: { x: 330, w: 20, h: 58 }, fixed: [], pieces: [{ len: 90 }, { len: 70 }, { len: 70 }],
    hint: 'Barely wider than the ball, and all three bars count. Small changes matter.' },
];

const only = process.argv[2];
for (const d of designs) {
  if (only && !d.id.startsWith(only)) continue;
  const t0 = Date.now();
  const direct = findDirectShot(d as Level);
  if (direct) { console.log(`${d.id}: WON WITHOUT BARS`, direct); continue; }
  const sol = findSolution(d as Level);
  if (!sol) { console.log(`${d.id}: no solution found`); continue; }
  const { robustness, par, ...solution } = sol;
  fs.writeFileSync(`levels/${d.id}.json`, JSON.stringify({ ...d, par, solution }, null, 2) + '\n');
  console.log(`${d.id}: no win without bars; par ${par}, solution uses all ${d.pieces.length} bar(s), robustness ${robustness}/49`, JSON.stringify(solution), `${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
