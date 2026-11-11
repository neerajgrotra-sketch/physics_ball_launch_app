const fs = require('fs');
const part = (f, stop) => { const s = fs.readFileSync(f, 'utf8'); return stop ? s.slice(0, s.indexOf(stop)) : s; };
eval(part('sound.js') + part('slice.js', 'const Slice =') + part('skim.js', 'const Skim =') + part('untangle.js', 'const Untangle =') +
`;globalThis.T = { SliceGeo, SkimPhys, UntangleGen, rng };`);
const { SliceGeo: G, SkimPhys: P, UntangleGen: U } = T;
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('FAIL', msg); } };
// Slice: square cut through the middle is 50%; a donut's hole doesn't count
const sq = { outer: [[0,0],[100,0],[100,100],[0,100]], holes: [] };
check(Math.abs(G.split(sq, [50,50], [0,1]) - 50) < 1e-9, 'square half');
check(Math.abs(G.split(sq, [25,0], [0,1]) - 75) < 1e-9 || Math.abs(G.split(sq, [25,0], [0,1]) - 25) < 1e-9, 'square quarter');
const ring = { outer: sq.outer, holes: [[[10,10],[10,40],[40,40],[40,10]]] }; // hole on the left
const p = G.split(ring, [50,50], [0,1]); check(Math.abs(Math.min(p, 100 - p) - 450 / 9100 * 100 * 0 - (5000 - 900) / 9100 * 100) < 1e-6 || Math.abs(Math.max(p,100-p) - 5000/9100*100) < 1e-6, 'hole counts ' + p);
// a concave L cut
const L = { outer: [[0,0],[100,0],[100,50],[50,50],[50,100],[0,100]], holes: [] };
const q = G.split(L, [0,25], [1,0]); check(Math.abs(Math.min(q,100-q) - 2500/7500*100) < 1e-6, 'L cut ' + q);
console.log('slice ok');
// Untangle: every level's own layout has no crossings; the scrambled one has some
for (const [i, n] of [4,4,5,5,5,6,6,6,7,7,7,8].entries()) {
  const lv = U.level(n, 9001 + i * 37);
  const solvedN = U.crossings(lv.solved, lv.edges).n, scr = U.crossings(lv.pos, lv.edges).n;
  check(solvedN === 0, `level ${i+1} solved layout has ${solvedN} crossings`);
  console.log(`untangle level ${i + 1}: ${lv.pos.length} pins, ${lv.edges.length} strings, ${scr} crossings to start`);
}
// Skim: skips for a spread of throws on calm and choppy water
const calm = { wind: 0, wave: { A: .015, k: 2, om: 2, ph: 0 } }, chop = { wind: -2, wave: { A: .06, k: 2.2, om: 2.4, ph: 1 } };
for (const [name, env] of [['calm', calm], ['choppy', chop]]) {
  const rows = [];
  for (const pw of [.4, .6, .8, 1]) { const sp = 6 + 22 * pw, r = []; for (const a of [-15, -8, 0, 6, 12, 20, 30]) r.push(P.simulate(a, sp, env).skips.length); rows.push(`power ${pw}: ` + r.join(' ')); }
  console.log(`skim ${name} (angles -15 -8 0 6 12 20 30):\n  ` + rows.join('\n  '));
}
// determinism
check(JSON.stringify(P.simulate(3, 20, chop, 1.7)) === JSON.stringify(P.simulate(3, 20, chop, 1.7)), 'skim deterministic');
console.log(fails ? fails + ' failures' : 'all checks passed');
