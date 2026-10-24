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
