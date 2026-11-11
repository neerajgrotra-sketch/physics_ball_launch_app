const fs = require('fs');
const part = (f, stop) => { const s = fs.readFileSync(f, 'utf8'); return stop ? s.slice(0, s.indexOf(stop)) : s; };
eval(part('sound.js') + part('code.js', 'const CrackCode =') + ';globalThis.T = { CodeGen };');
const G = T.CodeGen; let fails = 0;
const LEVELS = [...Array(5)].map((_, i) => ({ style: 'easy', seed: 7001 + i * 13 })).concat([...Array(5)].map((_, i) => ({ style: 'four', seed: 8101 + i * 17 })), [...Array(3)].map((_, i) => ({ style: 'tricky3', seed: 9201 + i * 19 })), [...Array(2)].map((_, i) => ({ style: 'tricky4', seed: 9301 + i * 23 })));
const t0 = Date.now();
LEVELS.forEach((lv, i) => {
  const p = G.generate(lv.seed, lv.style), sols = G.solutions(p.clues, p.n);
  const ok = sols.length === 1 && sols[0].join() === p.code.join() && p.clues.every(c => G.STYLES[lv.style].ok(c.a, c.b));
  if (!ok) { fails++; console.log('FAIL level', i + 1); }
  console.log(`level ${String(i + 1).padStart(2)} ${lv.style.padEnd(8)} code ${p.code.join('')} · ${p.clues.length} clues: ` + p.clues.map(c => c.guess.join('') + ' ' + c.a + '/' + c.b).join(', '));
});
const DAILY = ['tight', 'easy', 'easy', 'four', 'four', 'tight', 'tricky3'];
let maxMs = 0;
for (let day = 1; day <= 366; day++) { const s = Date.now(), p = G.generate(day * 9973 + 1, DAILY[day % 7]); maxMs = Math.max(maxMs, Date.now() - s); if (G.solutions(p.clues, p.n).length !== 1) { fails++; console.log('FAIL day', day); } }
// same seed, same puzzle
if (JSON.stringify(G.generate(42, 'four')) !== JSON.stringify(G.generate(42, 'four'))) { fails++; console.log('FAIL determinism'); }
console.log(`366 dailies checked, slowest ${maxMs} ms; total ${Date.now() - t0} ms`);
console.log(fails ? fails + ' failures' : 'all code checks passed');
