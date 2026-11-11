// Stickler puzzles. Never hand-edit puzzles.gen.js: edit here and run `node verify.js`, which checks every puzzle has an
// answer with exactly n moves/removals (move puzzles: none with fewer, since the game accepts a win in up to n moves) and stores one answer for the Hint button.
const rect = (w, h) => { const o = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o.push([x, y]); return o; };
const SH = {
  sq2: rect(2, 2), row3: rect(3, 1), row4: rect(4, 1), r23: rect(3, 2), sq3: rect(3, 3),
  tee: [[0, 0], [1, 0], [2, 0], [1, 1]], plus: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
  stairs: [[0, 0], [0, 1], [1, 1], [0, 2], [1, 2], [2, 2]],
};
module.exports = [
  { id: 't1', pack: 'take', kind: 'remove', cells: SH.sq2, W: 2, H: 2, n: 1, goal: 'exact', target: 3 },
  { id: 't2', pack: 'take', kind: 'remove', cells: SH.row3, W: 3, H: 1, n: 2, goal: 'exact', target: 2 },
  { id: 't3', pack: 'take', kind: 'remove', cells: SH.tee, W: 3, H: 2, n: 3, goal: 'exact', target: 3 },
  { id: 't4', pack: 'take', kind: 'remove', cells: SH.r23, W: 3, H: 2, n: 3, goal: 'exact', target: 2 },
  { id: 't5', pack: 'take', kind: 'remove', cells: SH.sq3, W: 3, H: 3, n: 5, goal: 'exact', target: 3 },
  { id: 't6', pack: 'take', kind: 'remove', cells: SH.stairs, W: 3, H: 3, n: 6, goal: 'exact', target: 5 },
  { id: 't7', pack: 'take', kind: 'remove', cells: SH.plus, W: 3, H: 3, n: 8, goal: 'exact', target: 2 },
  { id: 't8', pack: 'take', kind: 'remove', cells: SH.sq3, W: 3, H: 3, n: 6, goal: 'none' },
  { id: 's1', pack: 'shift', kind: 'move', cells: SH.tee, W: 3, H: 2, n: 2, goal: 'exact', target: 3 },
  { id: 's2', pack: 'shift', kind: 'move', cells: SH.plus, W: 3, H: 3, n: 2, goal: 'exact', target: 4 },
  { id: 's3', pack: 'shift', kind: 'move', cells: SH.sq2, W: 3, H: 2, n: 3, goal: 'exact', target: 3 },
  { id: 's4', pack: 'shift', kind: 'move', cells: SH.r23, W: 3, H: 3, n: 3, goal: 'exact', target: 4 },
  { id: 's5', pack: 'shift', kind: 'move', cells: SH.r23, W: 4, H: 2, n: 3, goal: 'exact', target: 3 },
  { id: 's6', pack: 'shift', kind: 'move', cells: SH.sq3, W: 4, H: 3, n: 3, goal: 'exact', target: 10 },
  { id: 'q1', pack: 'sum', kind: 'eq', eq: '1+1=3', n: 1 },
  { id: 'q2', pack: 'sum', kind: 'eq', eq: '2+3=6', n: 1 },
  { id: 'q3', pack: 'sum', kind: 'eq', eq: '7-1=9', n: 1 },
  { id: 'q4', pack: 'sum', kind: 'eq', eq: '6+4=4', n: 1 },
  { id: 'q5', pack: 'sum', kind: 'eq', eq: '5+7=2', n: 1 },
  { id: 'q6', pack: 'sum', kind: 'eq', eq: '5+5=19', n: 1 },
  { id: 'q7', pack: 'sum', kind: 'eq', eq: '3+8=6', n: 2 },
  { id: 'q8', pack: 'sum', kind: 'eq', eq: '2+6=3', n: 2 },
];
