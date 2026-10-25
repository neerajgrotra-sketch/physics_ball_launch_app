import { findSolution } from './find-solution';
import type { Level } from '../physics';
const level: Level = {
  id: 'needle', name: 'needle', hint: '', fixed: [],
  glass: { x: 326, w: 44, h: 60 },
  pieces: [{ len: 76 }, { len: 80 }, { len: 76 }, { len: 76 }, { len: 70 }],
  blocks: [{ x: 210, y: 79, w: 23, h: 158 }, { x: 125, y: 239, w: 29, h: 132 }, { x: 230, y: 346, w: 26, h: 140 }],
  hazards: [
    { x: 198, y: 35, w: 2, h: 70 }, { x: 125, y: 173, w: 29, h: 2 }, { x: 244, y: 310, w: 2, h: 72 },
    { x: 277, y: 528, w: 34, h: 24 }, { x: 378, y: 528, w: 32, h: 24 },
  ],
};
const t0 = Date.now();
const sol = findSolution(level, { samples: 700_000, want: 80, seed: 3 });
console.log(sol ? `FOUND par ${sol.par} robustness ${sol.robustness}/49 ${JSON.stringify(sol)}` : 'NO FORGIVING SOLUTION FOUND', `${((Date.now() - t0) / 1000).toFixed(0)}s`);
