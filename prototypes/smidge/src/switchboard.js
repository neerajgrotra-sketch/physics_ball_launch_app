// Switchboard: every bulb flips itself and its neighbours (the pattern changes in later levels). Switch every bulb off.
// Levels are made by pressing random bulbs on a dark board, so each has an answer; a solver over GF(2) finds the fewest
// taps (par) and the next step for a hint.
const SwitchCore = (() => {
  const RULES = {
    plus: { name: 'itself and the 4 next to it', cells: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] },
    x: { name: 'itself and the 4 corners round it', cells: [[0, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]] },
    ring: { name: 'the 8 round it, but not itself', cells: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] },
  };
  const effect = (n, rule, i) => { const x = i % n, y = (i / n) | 0; let m = 0; for (const [dx, dy] of RULES[rule].cells) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < n && Y < n) m |= 1 << (Y * n + X); } return m; };
  const press = (n, rule, state, i) => state ^ effect(n, rule, i);
  const pop = m => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
  // fewest presses (as a bit mask) that turn every bulb off, or null if none
  function solve(n, rule, state) {
    const N = n * n, rows = [], rhs = [];
    for (let i = 0; i < N; i++) { let m = 0; for (let j = 0; j < N; j++) if (effect(n, rule, j) >> i & 1) m |= 1 << j; rows.push(m); rhs.push(state >> i & 1); }
    const pivotCol = []; let r = 0;
    for (let c = 0; c < N && r < N; c++) {
      let p = -1; for (let k = r; k < N; k++) if (rows[k] >> c & 1) { p = k; break; }
      if (p < 0) continue;
      [rows[r], rows[p]] = [rows[p], rows[r]]; [rhs[r], rhs[p]] = [rhs[p], rhs[r]];
      for (let k = 0; k < N; k++) if (k !== r && rows[k] >> c & 1) { rows[k] ^= rows[r]; rhs[k] ^= rhs[r]; }
      pivotCol.push(c); r++;
    }
    for (let k = r; k < N; k++) if (rhs[k]) return null;
    const isPivot = new Set(pivotCol), free = []; for (let c = 0; c < N; c++) if (!isPivot.has(c)) free.push(c);
    let base = 0; pivotCol.forEach((c, k) => { if (rhs[k]) base |= 1 << c; });
    const null_ = free.map(f => { let v = 1 << f; pivotCol.forEach((c, k) => { if (rows[k] >> f & 1) v |= 1 << c; }); return v; });
    let best = base;
    for (let combo = 1; combo < (1 << null_.length); combo++) { let v = base; null_.forEach((b, k) => { if (combo >> k & 1) v ^= b; }); if (pop(v) < pop(best)) best = v; }
    return best;
  }
  function level(n, rule, k, seed) {
    const r = rng(seed); let state = 0, tries = 0;
    do { state = 0; const picks = new Set(); while (picks.size < k) picks.add(Math.floor(r() * n * n)); for (const i of picks) state = press(n, rule, state, i); tries++; } while ((state === 0 || pop(solve(n, rule, state)) < Math.min(k, 2)) && tries < 50);
    return { n, rule, start: state, par: pop(solve(n, rule, state)) };
  }
  return { RULES, effect, press, solve, level, pop };
})();

const Switchboard = (() => {
  const $ = id => document.getElementById(id);
  const S = SwitchCore;
  const LEVELS = [[3, 'plus', 2], [3, 'plus', 3], [4, 'plus', 3], [4, 'plus', 4], [5, 'plus', 4], [5, 'plus', 6], [3, 'x', 3], [4, 'x', 4], [5, 'x', 5], [3, 'ring', 2], [4, 'ring', 3], [5, 'ring', 4]]
    .map(([n, rule, k], i) => ({ n, rule, k, seed: 4242 + i * 101 }));
  let data = store('smidge/switchboard') || {};
  let li = 0, L = null, state = 0, taps = 0, hist = [], hints = 0, hintCell = -1, solved = false;
  function open(i) {
    li = i; const lv = LEVELS[i]; L = S.level(lv.n, lv.rule, lv.k, lv.seed); state = L.start; taps = 0; hist = []; hints = 0; hintCell = -1; solved = false;
    $('swMenu').hidden = true; $('swEnd').hidden = true;
    $('swSub').textContent = `Level ${i + 1} of ${LEVELS.length}`;
    $('swRule').innerHTML = ruleIcon(lv.rule) + `<span>A tap flips <b>${S.RULES[lv.rule].name}</b>.${i === 0 ? ' Switch every bulb off.' : ''}</span>`;
    render();
  }
  function ruleIcon(rule) {
    const cells = new Set(S.RULES[rule].cells.map(([x, y]) => (y + 1) * 3 + x + 1));
    return `<span class="sw-icon" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => `<i class="${cells.has(i) ? 'on' : ''} ${i === 4 ? 'mid' : ''}"></i>`).join('')}</span>`;
  }
  function render() {
    const n = L.n, grid = $('swGrid');
    grid.style.setProperty('--n', n);
    if (grid.children.length !== n * n) {
      grid.innerHTML = Array.from({ length: n * n }, (_, i) => `<button class="bulb" data-i="${i}" aria-label="Bulb ${i % n + 1}, ${((i / n) | 0) + 1}"><span></span></button>`).join('');
      grid.querySelectorAll('.bulb').forEach(b => b.onclick = () => tap(+b.dataset.i));
    }
    [...grid.children].forEach((b, i) => { const on = state >> i & 1; b.classList.toggle('on', !!on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.classList.toggle('hint', i === hintCell); });
    const lit = S.pop(state);
    $('swLit').textContent = solved ? 'All off!' : `${lit} lit`;
    $('swTaps').textContent = `${taps} tap${taps === 1 ? '' : 's'} · par ${L.par}`;
    $('swUndo').disabled = !hist.length || solved;
  }
  function tap(i) {
    if (!L || solved) return; Sound.audio();
    hist.push(state); state = S.press(L.n, L.rule, state, i); taps++; hintCell = -1;
    const lit = S.pop(state);
    Sound.tone(900, .02, 'square', .05); Sound.tone(260 + lit * 22, .12, 'triangle', .1, .02); haptic(8);
    render();
    if (state === 0) win();
  }
  function win() {
    solved = true; const stars = taps <= L.par ? 3 : taps <= L.par + 2 && !hints ? 2 : 1;
    const prev = data[li] || {}; data[li] = { stars: Math.max(prev.stars || 0, stars), taps: Math.min(prev.taps || 1e9, taps) }; store('smidge/switchboard', data);
    render(); [0, 4, 7, 12].forEach((s, i) => Sound.tone(523 * Math.pow(2, s / 12), .3, 'triangle', .14, i * .08)); haptic(40);
    $('swEndT').textContent = taps <= L.par ? 'Lights out, perfectly!' : 'All off!';
    $('swEndS').innerHTML = [0, 1, 2].map(i => i < stars ? '★' : '<span class="off">★</span>').join('');
    $('swEndP').textContent = taps <= L.par ? `${taps} taps, the fewest possible.` : `${taps} taps. It can be done in ${L.par}${hints ? '' : ', for three stars'}.`;
    $('swNext').textContent = li + 1 < LEVELS.length ? 'Next level' : 'All levels';
    setTimeout(() => { if (solved) $('swEnd').hidden = false; }, 800);
  }
  function hint() {
    if (!L || solved) return; Sound.audio();
    const sol = S.solve(L.n, L.rule, state); if (sol == null) return;
    for (let i = 0; i < L.n * L.n; i++) if (sol >> i & 1) { hintCell = i; break; }
    hints++; Sound.tone(880, .12, 'sine', .1); render();
  }
  function showMenu() {
    L = null;
    const firstOpen = (() => { const i = LEVELS.findIndex((_, k) => !data[k]); return i < 0 ? 0 : i; })();
    $('swGridMenu').innerHTML = LEVELS.map((lv, i) => `<button data-i="${i}" class="${i === firstOpen ? 'cur' : ''}">${i + 1}<small>${data[i] ? '★'.repeat(data[i].stars) : ''}</small></button>`).join('');
    $('swGridMenu').querySelectorAll('button').forEach(b => b.onclick = () => { Sound.audio(); open(+b.dataset.i); });
    $('swMenu').hidden = false; $('swEnd').hidden = true; $('swSub').textContent = 'Lights off'; $('swGrid').innerHTML = ''; $('swRule').innerHTML = ''; $('swLit').textContent = ''; $('swTaps').textContent = '';
  }
  $('swUndo').onclick = () => { if (!hist.length || solved) return; state = hist.pop(); taps++; hintCell = -1; Sound.tone(360, .06, 'triangle', .08); render(); };
  $('swHint').onclick = hint;
  $('swRestart').onclick = () => { if (L) { Sound.audio(); open(li); } };
  $('swLevels').onclick = () => { Sound.audio(); showMenu(); };
  $('swEndList').onclick = () => { Sound.audio(); showMenu(); };
  $('swNext').onclick = () => { Sound.audio(); if (li + 1 < LEVELS.length) open(li + 1); else showMenu(); };
  return {
    enter() { showMenu(); },
    leave() {},
    stats() { const v = LEVELS.map((_, i) => data[i]); return { done: v.filter(Boolean).length, stars: v.reduce((a, x) => a + (x ? x.stars : 0), 0), total: LEVELS.length }; },
    LEVELS,
  };
})();
