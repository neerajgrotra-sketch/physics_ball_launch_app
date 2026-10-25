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
  // From the owner's mockup: five bars, three blocks with spikes along one edge each (thin hazards laid on the block edge,
  // drawn under the block so only the outer spikes show), and spiked floor either side of the glass.
  { id: '13-needle', name: 'Needle', glass: { x: 326, w: 44, h: 60 }, fixed: [], pieces: [{ len: 76 }, { len: 80 }, { len: 76 }, { len: 76 }, { len: 70 }],
    blocks: [{ x: 210, y: 79, w: 23, h: 158 }, { x: 125, y: 239, w: 29, h: 132 }, { x: 230, y: 346, w: 26, h: 140 }],
    hazards: [
      { x: 198, y: 35, w: 2, h: 70 }, { x: 125, y: 173, w: 29, h: 2 }, { x: 244, y: 310, w: 2, h: 72 },
      { x: 277, y: 528, w: 34, h: 24 }, { x: 378, y: 528, w: 32, h: 24 },
    ],
    hint: 'Five bars, three walls with spikes on one side each, and spikes either side of the glass. Thread the ball down through all five.' },
  // Same recipe as Needle (walls with one spiked edge each, spikes beside the glass) but the glass is back by the cannon
  // under a spiked roof, so the ball has to fly out past the walls and return from the right, under the roof.
  { id: '14-boomerang', name: 'Boomerang', glass: { x: 140, w: 40, h: 56 }, fixed: [], pieces: [{ len: 90 }, { len: 80 }, { len: 70 }, { len: 70 }],
    blocks: [{ x: 135, y: 330, w: 120, h: 24 }, { x: 88, y: 430, w: 14, h: 200 }, { x: 255, y: 150, w: 24, h: 300 }, { x: 340, y: 395, w: 26, h: 290 }],
    hazards: [
      { x: 135, y: 318, w: 120, h: 2 }, { x: 81, y: 430, w: 2, h: 200 }, { x: 243, y: 210, w: 2, h: 180 }, { x: 340, y: 250, w: 26, h: 2 },
      { x: 215, y: 528, w: 36, h: 24 },
    ],
    hint: 'The glass sits in a garage by the cannon, open only on the right. Send the ball out past the spiked walls and bring it home.' },
  // Boomerang's garage, raised: the glass stands 120 up under a spiked roof with a spiked back wall (open on the right),
  // over a bed of spikes, so the ball must come home from the right, high up. (Found with a bigger search than design-levels
  // runs: seed 11, 700k samples; a glass 140 up only just works, 8/49 at power 99.5, so it stays at 120.)
  { id: '15-penthouse', name: 'Penthouse', glass: { x: 140, w: 40, h: 56, base: 420 }, fixed: [], pieces: [{ len: 90 }, { len: 80 }, { len: 70 }, { len: 70 }],
    blocks: [{ x: 140, y: 220, w: 120, h: 24 }, { x: 88, y: 374, w: 14, h: 332 }, { x: 255, y: 150, w: 24, h: 300 }, { x: 340, y: 395, w: 26, h: 290 }],
    hazards: [
      { x: 140, y: 208, w: 120, h: 2 }, { x: 81, y: 374, w: 2, h: 332 }, { x: 243, y: 210, w: 2, h: 180 }, { x: 340, y: 250, w: 26, h: 2 },
      { x: 155, y: 528, w: 150, h: 24 },
    ],
    hint: 'The glass is up in a penthouse with a spiked roof and spikes below. Send the ball out past the walls and bring it home high, from the right.' },
  // Penthouse with a fifth bar. Its answer needed a much bigger search than design-levels runs (3M attempts, seed 43;
  // a hundred-odd times harder to stumble on than Needle), and stays near the edge: 11/49 at power 96.7.
  { id: '16-skyline', name: 'Skyline', glass: { x: 140, w: 40, h: 56, base: 420 }, fixed: [], pieces: [{ len: 90 }, { len: 80 }, { len: 70 }, { len: 70 }, { len: 60 }],
    blocks: [{ x: 140, y: 220, w: 120, h: 24 }, { x: 88, y: 374, w: 14, h: 332 }, { x: 255, y: 150, w: 24, h: 300 }, { x: 340, y: 395, w: 26, h: 290 }],
    hazards: [
      { x: 140, y: 208, w: 120, h: 2 }, { x: 81, y: 374, w: 2, h: 332 }, { x: 243, y: 210, w: 2, h: 180 }, { x: 340, y: 250, w: 26, h: 2 },
      { x: 155, y: 528, w: 150, h: 24 },
    ],
    hint: 'Penthouse with a fifth bar. The glass is up under a spiked roof: go out high past the walls, use all five bars, and come home from the right.' },
  // A wall-bank level: the glass is under a spiked roof, shut on the left, so it can only be entered from the right through a
  // corridor only 45 wide beside the board's own right wall (too narrow to place a bar across), so the way in is to come down it and
  // bank off that wall (tools/needs-walls.ts checks it).
  { id: '17-cushion', name: 'Cushion', glass: { x: 315, w: 40, h: 56 }, fixed: [], pieces: [{ len: 90 }, { len: 80 }],
    blocks: [{ x: 300, y: 380, w: 110, h: 24 }, { x: 252, y: 460, w: 14, h: 160 }],
    hazards: [{ x: 300, y: 368, w: 110, h: 2 }, { x: 245, y: 460, w: 2, h: 160 }, { x: 277, y: 528, w: 36, h: 24 }, { x: 378, y: 528, w: 40, h: 24 }],
    hint: 'The glass is shut in on the left and the only way in is a narrow gap beside the right wall. Come down it and bank off the wall, using both bars.' },
  // The first spring pad: it kicks the ball back harder than it arrived (PAD_RESTITUTION, PAD_KICK), so a ball dropped onto it from
  // low down is thrown up to the glass hanging in the top right corner, behind a wall that stands between it and the cannon.
  { id: '18-springboard', name: 'Springboard', glass: { x: 345, w: 40, h: 56, base: 200 }, fixed: [], pieces: [{ len: 90 }, { len: 80 }],
    blocks: [{ x: 190, y: 420, w: 20, h: 240 }],
    pads: [{ x: 300, y: 530, w: 80, h: 12 }],
    hint: 'The golden pad is a spring: whatever lands on it is thrown back harder. Drop the ball onto it and send it up to the glass, using both bars.' },
  // Pinball: two spring pads (one on the floor, one set into the right wall like a bumper), a spiked roof just above the glass so a
  // ball thrown too hard dies and a pillar holding the glass up. The answer has to use a pad.
  { id: '19-pinball', name: 'Pinball', glass: { x: 205, w: 40, h: 56, base: 262 }, fixed: [], pieces: [{ len: 90 }, { len: 80 }],
    blocks: [{ x: 205, y: 403, w: 44, h: 274 }],
    pads: [{ x: 330, y: 530, w: 80, h: 12 }, { x: 391, y: 330, w: 12, h: 110 }],
    hazards: [{ x: 205, y: 118, w: 170, h: 12 }],
    hint: 'Two golden spring pads, and a spiked roof over the glass. Throw too hard and the ball is lost on the spikes: use a pad and both bars to drop it in.' },
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
