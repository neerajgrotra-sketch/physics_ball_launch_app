// Level source of truth for geometry. Run: npx tsx tools/design-levels.ts
// Writes levels/*.json after proving each level has no direct shot and finding a robust solution.
import fs from 'node:fs';
import { glassBox, type Level, type FixedSegment } from '../physics';
import { findDirectShot } from './verify-direct';
import { findSolution } from './find-solution';

/** Dead hood over the glass: covers the mouth and seals the left side, so it only opens to the right. */
function hood(glass: Level['glass'], height: number): FixedSegment[] {
  const { l, r, rim } = glassBox(glass);
  return [[l, rim - height, r + 4, rim - height], [l, rim - height, l, rim]];
}
/** Dead ledge for a raised glass: a top surface just under the glass floor plus a front face to the ground. */
function ledge(glass: Level['glass'], fromX: number): FixedSegment[] {
  const { base } = glassBox(glass);
  return [[fromX, base + 2, 400, base + 2], [fromX, base + 2, fromX, 700]];
}

const g1 = { x: 200, w: 40, h: 50 };
const g2 = { x: 110, w: 36, h: 52 };
const g3 = { x: 285, w: 34, h: 50, base: 420 };
const g4 = { x: 125, w: 30, h: 54 };
const g5 = { x: 255, w: 21, h: 58, base: 440 };

const designs: Omit<Level, 'solution'>[] = [
  { id: '01-first-bounce', name: 'First bounce', glass: g1, fixed: hood(g1, 72), pieces: [{ len: 90 }],
    hint: 'Only your bars bounce. The glass opens to the right, so send the ball past it and bounce it back.' },
  { id: '02-long-way-back', name: 'Long way back', glass: g2, fixed: [...hood(g2, 70), [240, 430, 240, 700]], pieces: [{ len: 90 }],
    hint: 'The post is dead. Find a way to bring the ball back from the right.' },
  { id: '03-high-ground', name: 'High ground', glass: g3, fixed: [...hood(g3, 66), ...ledge(g3, 245)], pieces: [{ len: 90 }],
    hint: 'The glass sits on a ledge. Anything grey stops the ball dead.' },
  { id: '04-crossfire', name: 'Crossfire', glass: g4, fixed: [...hood(g4, 70), [200, 260, 200, 700], [250, 150, 400, 150]], pieces: [{ len: 90 }, { len: 70 }],
    hint: 'Two bars to work with. The ceiling on the right is dead too.' },
  { id: '05-four-millimetres', name: 'Four millimetres', glass: g5, fixed: [...hood(g5, 64), ...ledge(g5, 220), [300, 110, 400, 110]], pieces: [{ len: 90 }, { len: 70 }],
    hint: 'Barely wider than the ball. Small changes matter here.' },
];

const only = process.argv[2];
for (const d of designs) {
  if (only && !d.id.startsWith(only)) continue;
  const t0 = Date.now();
  const direct = findDirectShot(d as Level);
  if (direct) { console.log(`${d.id}: DIRECT SHOT EXISTS`, direct); continue; }
  const sol = findSolution(d as Level, { samples: 300_000 });
  if (!sol) { console.log(`${d.id}: no solution found`); continue; }
  const { robustness, ...solution } = sol;
  fs.writeFileSync(`levels/${d.id}.json`, JSON.stringify({ ...d, solution }, null, 2) + '\n');
  console.log(`${d.id}: no direct shot (checked all 0.1 inputs); solution robustness ${robustness}/49`, JSON.stringify(solution), `${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
