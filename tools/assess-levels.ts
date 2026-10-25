// Usage: npx tsx tools/assess-levels.ts [samples] [level index]   (an index prints that level as one JSON line, so levels can run in parallel)
// Measures every level so the difficulty curve can be judged on numbers, not by eye:
//   structure   bars, blocks, hazards, glass width and height off the floor
//   par         the fewest bounces the solver found
//   forgiving   how many of the 49 neighbouring 0.1 inputs around the stored solution also win
//   deaths      share of plain (bar-less) shots that end on a hazard
//   findability random bar-chains the solver finds per 10,000 tries (lower = harder to stumble on a way in)
import { LEVELS } from '../levels';
import { buildWorld, simulate, solutionPieces, glassBox, WORLD } from '../physics';
import { findChains } from './find-solution';

const samples = Number(process.argv[2] ?? 30000);
const only = process.argv[3] === undefined ? null : Number(process.argv[3]);
const rows: Record<string, string | number>[] = [];
LEVELS.forEach((level, i) => {
  if (only !== null && i !== only) return;
  const t0 = Date.now();
  const sol = level.solution!;
  const world = buildWorld(level, solutionPieces(level));
  let near = 0;
  for (let a = -3; a <= 3; a++) for (let p = -3; p <= 3; p++)
    if (simulate(world, +(sol.angle + a * 0.1).toFixed(1), +(sol.power + p * 0.1).toFixed(1), Infinity).success) near++;
  const bare = buildWorld(level, []);
  let dead = 0, total = 0;
  for (let a = 20; a <= 85; a += 5) for (let p = 30; p <= 100; p += 5) { total++; if (simulate(bare, a, p, Infinity).end === 'dead') dead++; }
  const chains = findChains(level, samples, 7, 1e9).length;
  const g = glassBox(level.glass);
  rows.push({
    '#': i + 1, id: level.id, bars: level.pieces.length, blocks: level.blocks?.length ?? 0, hazards: level.hazards?.length ?? 0,
    glassW: level.glass.w, glassUp: Math.round(WORLD.ground - g.base), par: level.par ?? 0,
    forgiving: `${near}/49`, deaths: `${Math.round((100 * dead) / total)}%`, found: Math.round((chains * 10000) / samples),
  });
  console.error(`${level.id} done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
});
if (only !== null) console.log("ROW " + JSON.stringify(rows[0]));
else console.table(rows);
