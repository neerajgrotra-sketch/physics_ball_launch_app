// Usage: npx tsx tools/report.ts
// For each level: confirms there is no direct shot, and how forgiving the stored solution is.
import { LEVELS } from '../levels';
import { buildWorld, simulate, solutionPieces } from '../physics';
import { findDirectShot } from './verify-direct';

for (const level of LEVELS) {
  const direct = findDirectShot(level);
  const s = level.solution!;
  const world = buildWorld(level, solutionPieces(level));
  let near = 0;
  for (let a = -3; a <= 3; a++) for (let p = -3; p <= 3; p++)
    if (simulate(world, +(s.angle + a * 0.1).toFixed(1), +(s.power + p * 0.1).toFixed(1), Infinity).success) near++;
  console.log(`${level.id.padEnd(22)} direct shot: ${direct ? 'YES ' + JSON.stringify(direct) : 'none'}   solution lands: ${simulate(world, s.angle, s.power).success}   forgiveness ${near}/49`);
}
