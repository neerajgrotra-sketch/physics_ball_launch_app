// Usage: npx tsx tools/needs-walls.ts <level id prefix> [samples] [seed]
// Does a level need the board's own walls? It reports how many of the stored answer's bounces were off the floor or
// the board edges, then searches for an answer in a copy of the level where those edges are deadly (Level.edgesDead):
// if the normal level has an answer and the deadly-edges copy has none, the walls are needed (or at least, the search
// found no way without them). Search effort is the same for both, so this is evidence, not proof.
import { LEVELS } from '../levels';
import { buildWorld, simulate, solutionPieces } from '../physics';
import { findSolution } from './find-solution';

const prefix = process.argv[2] ?? '';
const samples = Number(process.argv[3] ?? 1_000_000), seed = Number(process.argv[4] ?? 5);
const level = LEVELS.find((l) => l.id.startsWith(prefix));
if (!level) throw new Error('no such level: ' + prefix);
const s = level.solution!;
const r = simulate(buildWorld(level, solutionPieces(level)), s.angle, s.power);
const wallHits = r.hits.filter((h) => h.kind === 'wall' && h.counts).length;
console.log(`${level.id}: the stored answer has ${r.bounces} bounces, ${wallHits} of them off the floor or board edges (${r.hits.map((h) => h.kind[0] + (h.counts ? '' : '*')).join(' ')})`);
const t0 = Date.now();
const dead = findSolution({ ...level, solution: undefined, par: undefined, edgesDead: true }, { samples, want: 200, seed });
console.log(dead
  ? `WITH DEADLY EDGES a solution was still found (par ${dead.par}, forgiving ${dead.robustness}/49): the walls are not strictly needed`
  : `WITH DEADLY EDGES no solution was found in ${samples.toLocaleString()} attempts: the walls look needed`, `(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
