// Untangle: drag the pins until no two strings cross. Every level is built from straight lines that cross each other, so it
// always has an answer (the crossing points of n lines, joined along each line, can always be laid out flat).
const UntangleGen = (() => {
  function level(n, seed) {
    const r = rng(seed), lines = [];
    for (let i = 0; i < n; i++) { const a = r() * Math.PI, px = .5 + (r() - .5) * .4, py = .5 + (r() - .5) * .4; lines.push({ p: [px, py], d: [Math.cos(a), Math.sin(a)] }); }
    const verts = [], onLine = lines.map(() => []);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const A = lines[i], B = lines[j], den = A.d[0] * B.d[1] - A.d[1] * B.d[0];
      if (Math.abs(den) < 1e-6) continue;
      const t = ((B.p[0] - A.p[0]) * B.d[1] - (B.p[1] - A.p[1]) * B.d[0]) / den, u = ((B.p[0] - A.p[0]) * A.d[1] - (B.p[1] - A.p[1]) * A.d[0]) / den;
      const id = verts.length; verts.push([A.p[0] + A.d[0] * t, A.p[1] + A.d[1] * t]);
      onLine[i].push([t, id]); onLine[j].push([u, id]);
    }
    const edges = [];
    for (const l of onLine) { l.sort((a, b) => a[0] - b[0]); for (let k = 1; k < l.length; k++) edges.push([l[k - 1][1], l[k][1]]); }
    // scramble: pins round a circle in shuffled order
    const order = verts.map((_, i) => i); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const pos = []; order.forEach((v, k) => { const a = k / order.length * Math.PI * 2 - Math.PI / 2; pos[v] = [.5 + Math.cos(a) * .42, .5 + Math.sin(a) * .42]; });
    return { pos, edges, solved: verts };
  }
  function cross(p1, p2, p3, p4) {
    const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }
  function crossings(pos, edges) {
    const bad = new Set(); let n = 0;
    for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
      const [a, b] = edges[i], [c, e] = edges[j];
      if (a === c || a === e || b === c || b === e) continue;
      if (cross(pos[a], pos[b], pos[c], pos[e])) { n++; bad.add(i); bad.add(j); }
    }
    return { n, bad };
  }
  return { level, crossings };
})();

const Untangle = (() => {
  const $ = id => document.getElementById(id);
  const LEVELS = [4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8].map((n, i) => ({ n, seed: 9001 + i * 37 }));
  const svgWrap = $('unBoard');
  let data = store('smidge/untangle') || {};
  let li = 0, L = null, pos = null, drag = null, moves = 0, startT = 0, solved = false, timer = 0;

  const par = lv => Math.round(lv.n * (lv.n - 1) / 2 * 5); // seconds for three stars
  function starsFor(lv, secs) { const p = par(lv); return secs <= p ? 3 : secs <= p * 2 ? 2 : 1; }
  function open(i) {
    li = i; const lv = LEVELS[i]; L = UntangleGen.level(lv.n, lv.seed);
    pos = L.pos.map(p => p.slice()); moves = 0; startT = 0; solved = false;
    if (UntangleGen.crossings(pos, L.edges).n === 0) { pos.reverse(); }
    $('unMenu').hidden = true; $('unEnd').hidden = true;
    $('unSub').textContent = `Level ${i + 1} of ${LEVELS.length} · ${pos.length} pins`;
    $('unHint').innerHTML = i === 0 ? 'Drag the pins until <b>no strings cross</b>. Red strings are crossing.' : 'Drag the pins until no strings cross';
    render(); tickClock();
  }
  function render(focus) {
    const { n, bad } = UntangleGen.crossings(pos, L.edges);
    let s = '<svg viewBox="-40 -40 1080 1080" preserveAspectRatio="xMidYMid meet">';
    L.edges.forEach(([a, b], i) => {
      const A = pos[a], B = pos[b], hot = bad.has(i);
      s += `<line x1="${A[0] * 1000}" y1="${A[1] * 1000}" x2="${B[0] * 1000}" y2="${B[1] * 1000}" class="yarn ${hot ? 'hot' : ''} ${solved ? 'won' : ''}"/>`;
    });
    pos.forEach((p, i) => { s += `<g class="pin ${focus === i ? 'held' : ''}" transform="translate(${p[0] * 1000} ${p[1] * 1000})"><circle class="pin-hit" r="60" data-i="${i}"/><circle class="pin-shadow" cx="4" cy="7" r="26"/><circle class="pin-head" r="25" style="--h:${(i * 47) % 360}"/><circle class="pin-shine" cx="-8" cy="-9" r="7"/></g>`; });
    s += '</svg>';
    svgWrap.innerHTML = s;
    $('unCount').textContent = solved ? 'All clear!' : `${n} crossing${n === 1 ? '' : 's'}`;
    $('unCount').classList.toggle('zero', solved);
    return n;
  }
  function tickClock() {
    clearInterval(timer);
    timer = setInterval(() => { if (solved || !L || !startT) return; $('unTime').textContent = fmt((performance.now() - startT) / 1000); }, 250);
    $('unTime').textContent = '0:00'; $('unMoves').textContent = '0 moves';
  }
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function win() {
    solved = true; const secs = (performance.now() - startT) / 1000, lv = LEVELS[li], stars = starsFor(lv, secs);
    const prev = data[li] || {}; data[li] = { stars: Math.max(prev.stars || 0, stars), best: Math.min(prev.best || 1e9, secs) }; store('smidge/untangle', data);
    render();
    [0, 4, 7, 12].forEach((s2, i) => Sound.tone(587 * Math.pow(2, s2 / 12), .3, 'triangle', .15, i * .08)); haptic(40);
    $('unEndT').textContent = ['Untangled!', 'Smooth!', 'Neat work!'][li % 3];
    $('unEndS').innerHTML = [0, 1, 2].map(i => i < stars ? '★' : '<span class="off">★</span>').join('');
    $('unEndP').textContent = `${fmt(secs)} and ${moves} move${moves === 1 ? '' : 's'}. ${stars < 3 ? `Under ${fmt(par(lv))} earns three stars.` : 'Three stars.'}`;
    $('unNext').textContent = li + 1 < LEVELS.length ? 'Next level' : 'All levels';
    setTimeout(() => { if (solved) $('unEnd').hidden = false; }, 900);
  }
  function showMenu() {
    L = null; clearInterval(timer);
    $('unGrid').innerHTML = LEVELS.map((lv, i) => `<button data-i="${i}" class="${i === firstOpen() ? 'cur' : ''}">${i + 1}<small>${data[i] ? '★'.repeat(data[i].stars) : ''}</small></button>`).join('');
    $('unGrid').querySelectorAll('button').forEach(b => b.onclick = () => { Sound.audio(); open(+b.dataset.i); });
    $('unMenu').hidden = false; $('unEnd').hidden = true; svgWrap.innerHTML = '';
    $('unSub').textContent = 'Pins and string'; $('unHint').textContent = ''; $('unCount').textContent = ''; $('unTime').textContent = ''; $('unMoves').textContent = '';
  }
  const firstOpen = () => { const i = LEVELS.findIndex((_, k) => !data[k]); return i < 0 ? 0 : i; };
  svgWrap.addEventListener('pointerdown', e => {
    if (!L || solved) return;
    const i = e.target.dataset ? e.target.dataset.i : undefined; if (i == null) return;
    e.preventDefault(); Sound.audio(); drag = { i: +i, moved: false, last: performance.now() };
    if (!startT) startT = performance.now();
    try { svgWrap.setPointerCapture(e.pointerId); } catch (err) {}
    Sound.tone(520, .04, 'triangle', .08); render(drag.i);
  });
  svgWrap.addEventListener('pointermove', e => {
    if (!drag) return; const svg = svgWrap.querySelector('svg'); if (!svg) return;
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    pos[drag.i] = [Math.max(0, Math.min(1, p.x / 1000)), Math.max(0, Math.min(1, p.y / 1000))]; drag.moved = true;
    const n = render(drag.i);
    if (drag.n != null && n < drag.n) Sound.tone(700 + Math.max(0, 20 - n) * 25, .05, 'sine', .07);
    drag.n = n;
  });
  svgWrap.addEventListener('pointerup', () => {
    if (!drag) return; const d = drag; drag = null;
    if (d.moved) { moves++; $('unMoves').textContent = `${moves} move${moves === 1 ? '' : 's'}`; Sound.tone(380, .05, 'triangle', .1); haptic(6); }
    const n = render(); if (n === 0) win();
  });
  svgWrap.addEventListener('pointercancel', () => { drag = null; if (L) render(); });
  $('unList').onclick = () => { Sound.audio(); showMenu(); };
  $('unEndList').onclick = () => { Sound.audio(); showMenu(); };
  $('unNext').onclick = () => { Sound.audio(); if (li + 1 < LEVELS.length) open(li + 1); else showMenu(); };
  $('unRestart').onclick = () => { if (L) { Sound.audio(); open(li); } };
  return {
    enter() { showMenu(); },
    leave() { drag = null; clearInterval(timer); },
    stats() { const vals = LEVELS.map((_, i) => data[i]); return { done: vals.filter(Boolean).length, stars: vals.reduce((a, v) => a + (v ? v.stars : 0), 0), total: LEVELS.length }; },
  };
})();
