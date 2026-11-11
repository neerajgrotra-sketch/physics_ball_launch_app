const fs = require('fs');
const part = (f, stop) => { const s = fs.readFileSync(f, 'utf8'); return stop ? s.slice(0, s.indexOf(stop)) : s; };
eval(part('sound.js') + part('slice.js', 'const Slice =') + part('skim.js', 'const Skim =') + part('untangle.js', 'const Untangle =') + part('pour.js', 'const Pour =') + part('eyeball.js', 'const Eyeball =') + part('switchboard.js', 'const Switchboard =') +
`;globalThis.T = { SliceGeo, SkimPhys, UntangleGen, rng, PourPhys, EyeGeo, SwitchCore };`);
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
// Pour: level rises with area and a cone fills fast low down, slowly near the top
{ const Pp = T.PourPhys; for (const kind of Object.keys(Pp.PROFILES)) { const cum = Pp.table({ kind, a: .5 }), full = cum[cum.length - 1]; let prev = -1, ok = true; for (let k = 0; k <= 20; k++) { const l = Pp.levelFor(cum, full * k / 20); if (l < prev - 1e-9) ok = false; prev = l; } check(ok && Math.abs(Pp.levelFor(cum, full) - 1) < 1e-6, 'pour level ' + kind); }
  const cum = Pp.table({ kind: 'cone', a: .5 }), full = cum[cum.length - 1]; check(Pp.levelFor(cum, full * .25) > .45, 'cone fills fast low down'); console.log('pour ok'); }
// Eyeball: guessing the answer scores 100, and points fall with the error
{ const r = T.rng(5); for (const k of ['mid', 'right', 'centre', 'bisect', 'square', 'balance']) { const t = T.EyeGeo.make(k, r), j0 = T.EyeGeo.judge(t, [0, 0]), j = T.EyeGeo.judge(t, j0.ans); check(j.err < 1e-6 && T.EyeGeo.points(j) === 100, 'eyeball exact ' + k + ' ' + j.err); } console.log('eyeball ok'); }
// Switchboard: every level has an answer, par is no more than the taps that made it, and the answer switches all off
{ const S = T.SwitchCore; [[3,'plus',2],[3,'plus',3],[4,'plus',3],[4,'plus',4],[5,'plus',4],[5,'plus',6],[3,'x',3],[4,'x',4],[5,'x',5],[3,'ring',2],[4,'ring',3],[5,'ring',4]].forEach(([n, rule, k], i) => {
  const lv = S.level(n, rule, k, 4242 + i * 101), sol = S.solve(n, rule, lv.start); let st = lv.start; for (let c = 0; c < n * n; c++) if (sol >> c & 1) st = S.press(n, rule, st, c);
  check(st === 0 && lv.par <= k && lv.par >= 1, `switchboard level ${i + 1}`); console.log(`switchboard level ${i + 1}: ${n}x${n} ${rule}, par ${lv.par}, ${S.pop(lv.start)} lit`); }); }
console.log(fails ? fails + ' failures' : 'all checks passed');
