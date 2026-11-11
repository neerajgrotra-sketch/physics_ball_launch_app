// Slice: one swipe cuts a paper shape; get the pieces as close to the asked split as you can. Five shapes a round.
const SliceGeo = (() => {
  // polygons are arrays of [x, y]; a shape is { outer, holes }
  const area = p => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.abs(a) / 2; };
  const shapeArea = s => area(s.outer) - s.holes.reduce((t, h) => t + area(h), 0);
  function clip(poly, a, d, side) { // keep the part where side * cross(d, p - a) >= 0
    const out = [], f = p => side * (d[0] * (p[1] - a[1]) - d[1] * (p[0] - a[0]));
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], fp = f(p), fq = f(q);
      if (fp >= 0) out.push(p);
      if ((fp >= 0) !== (fq >= 0)) { const t = fp / (fp - fq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
    return out.length >= 3 ? out : [];
  }
  const cutShape = (s, a, d, side) => ({ outer: clip(s.outer, a, d, side), holes: s.holes.map(h => clip(h, a, d, side)).filter(h => h.length) });
  function centroid(p) { let x = 0, y = 0, A = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const c = p[j][0] * p[i][1] - p[i][0] * p[j][1]; A += c; x += (p[j][0] + p[i][0]) * c; y += (p[j][1] + p[i][1]) * c; } return A ? [x / (3 * A), y / (3 * A)] : p[0]; }
  // The share of the shape on the + side of the line through a along d, in percent.
  function split(s, a, d) { const t = shapeArea(s), A = shapeArea(cutShape(s, a, d, 1)); return t ? 100 * A / t : 0; }
  function inside(s, pt) {
    const inPoly = p => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > pt[1]) !== (p[j][1] > pt[1]) && pt[0] < (p[j][0] - p[i][0]) * (pt[1] - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
    return inPoly(s.outer) && !s.holes.some(inPoly);
  }
  return { area, shapeArea, clip, cutShape, centroid, split, inside };
})();

const Slice = (() => {
  const $ = id => document.getElementById(id);
  const G = SliceGeo, N = 5, PAPER = ['#ff6b5e', '#ffc23a', '#2fb8a8', '#8a6cf0', '#ff7ab0'];
  const cv = $('slCanvas'), ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1, active = false, last = 0;
  let mode = 'daily', seed = 1, round = 0, shapes = [], results = [], state = 'menu', drag = null, cut = null, t = 0, cutAt = 0;
  let data = store('smidge/slice') || { daily: {}, best: 0 };

  // ---------- shapes (seeded, so a daily round is the same for everyone) ----------
  const ring = (n, f) => Array.from({ length: n }, (_, i) => f(i * Math.PI * 2 / n, i));
  function makeShape(r, kind) {
    let outer, holes = [];
    if (kind === 'blob') { const ph = [r() * 6, r() * 6, r() * 6], am = [.14 + r() * .12, .08 + r() * .1, .05 + r() * .06]; outer = ring(64, a => { const k = 1 + am[0] * Math.sin(2 * a + ph[0]) + am[1] * Math.sin(3 * a + ph[1]) + am[2] * Math.sin(5 * a + ph[2]); return [Math.cos(a) * k, Math.sin(a) * k]; }); }
    else if (kind === 'star') { const n = 5 + Math.floor(r() * 3), inn = .42 + r() * .16; outer = ring(n * 2, (a, i) => { const k = i % 2 ? inn : 1; return [Math.cos(a - Math.PI / 2) * k, Math.sin(a - Math.PI / 2) * k]; }); }
    else if (kind === 'poly') { const n = 3 + Math.floor(r() * 5), sx = .75 + r() * .5; outer = ring(n, a => [Math.cos(a) * sx, Math.sin(a)]); }
    else if (kind === 'heart') { outer = ring(72, a => { const x = 16 * Math.pow(Math.sin(a), 3), y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a); return [x / 16, -y / 16]; }); }
    else if (kind === 'ell') { const w = .45 + r() * .2; outer = [[-1, -1], [-1 + w * 1.4, -1], [-1 + w * 1.4, 1 - w * 1.4], [1, 1 - w * 1.4], [1, 1], [-1, 1]]; }
    else if (kind === 'house') { outer = [[-.8, 1], [-.8, -.1], [-.95, -.1], [0, -1], [.45, -.53], [.45, -.9], [.7, -.9], [.7, -.27], [.95, -.1], [.8, -.1], [.8, 1]]; }
    else if (kind === 'fish') { outer = [[-1, 0], [-.55, -.5], [0, -.62], [.45, -.4], [.7, -.1], [1, -.55], [.95, 0], [1, .55], [.7, .1], [.45, .4], [0, .62], [-.55, .5]]; }
    else if (kind === 'bolt') { outer = [[-.2, -1], [.55, -1], [.1, -.2], [.6, -.2], [-.45, 1], [-.1, .1], [-.6, .1]]; }
    else if (kind === 'donut') { outer = ring(64, a => [Math.cos(a), Math.sin(a)]); const ox = (r() - .5) * .5, oy = (r() - .5) * .5, rr = .32 + r() * .14; holes = [ring(40, a => [ox + Math.cos(a) * rr, oy + Math.sin(a) * rr]).reverse()]; }
    else if (kind === 'frame') { outer = [[-1, -.8], [1, -.8], [1, .8], [-1, .8]]; const hx = (r() - .5) * .5; holes = [[[hx - .4, -.4], [hx - .4, .35], [hx + .45, .35], [hx + .45, -.4]]]; }
    // random turn and stretch, then fit about 270 units across, centred on the board
    const rot = r() * Math.PI * 2, st = .85 + r() * .3, c = Math.cos(rot), s = Math.sin(rot);
    const tf = p => [p[0] * st * c - p[1] * s, p[0] * st * s + p[1] * c];
    outer = outer.map(tf); holes = holes.map(h => h.map(tf));
    let mx = 1e9, Mx = -1e9, my = 1e9, My = -1e9; for (const [x, y] of outer) { mx = Math.min(mx, x); Mx = Math.max(Mx, x); my = Math.min(my, y); My = Math.max(My, y); }
    const k = 270 / Math.max(Mx - mx, My - my), cx = (mx + Mx) / 2, cy = (my + My) / 2, fit = p => [200 + (p[0] - cx) * k, 200 + (p[1] - cy) * k];
    return { outer: outer.map(fit), holes: holes.map(h => h.map(fit)) };
  }
  function makeRound(sd) {
    const r = rng(sd), pick = a => a[Math.floor(r() * a.length)];
    const plan = [
      { kinds: ['poly', 'blob'], target: 50 },
      { kinds: ['star', 'heart', 'fish', 'bolt'], target: 50 },
      { kinds: ['blob', 'house', 'ell'], target: 25 },
      { kinds: ['star', 'fish', 'blob', 'ell'], target: 50, pin: true },
      { kinds: ['donut', 'frame'], target: 50, spin: .35 },
    ];
    return plan.map((pl, i) => finishShape(makeShape(r, pick(pl.kinds)), r, pl, PAPER[i]));
  }
  function finishShape(s, r, pl, color) {
    s.target = pl.target; s.color = color; s.spin = pl.spin ? pl.spin * (r() < .5 ? -1 : 1) : 0;
    if (pl.pin) { for (let k = 0; k < 200; k++) { const p = [80 + r() * 240, 80 + r() * 240]; const c = G.centroid(s.outer); if (G.inside(s, p) && Math.hypot(p[0] - c[0], p[1] - c[1]) > 45) { s.pin = p; break; } } }
    return s;
  }
  // levels: one shape each, getting harder; each tile in the list shows the shape, and your best cut once played
  const LEVELS = [
    ['poly', 50], ['blob', 50], ['poly', 50], ['heart', 50], ['star', 50], ['fish', 50], ['bolt', 50], ['house', 50],
    ['blob', 25], ['ell', 25], ['house', 25], ['star', 100 / 3], ['blob', 50, 'pin'], ['fish', 50, 'pin'], ['ell', 50, 'pin'], ['star', 50, 'pin'],
    ['donut', 50], ['frame', 50], ['donut', 50, 'spin'], ['frame', 25, 'spin'],
  ].map(([kind, target, tw], i) => ({ kind, target, pin: tw === 'pin', spin: tw === 'spin' ? .35 : 0, seed: 5101 + i * 31 }));
  function levelShape(i) { const L = LEVELS[i], r = rng(L.seed); return finishShape(makeShape(r, L.kind), r, L, PAPER[i % PAPER.length]); }
  const tagFor = L => L.pin ? 'Pin' : L.spin ? 'Spin' : L.target === 25 ? 'Quarter' : L.target < 40 ? 'Third' : L.kind === 'donut' || L.kind === 'frame' ? 'Hole' : 'Half';
  function promptFor(s) {
    const base = s.target === 50 ? 'Cut it in half' : s.target === 25 ? 'Cut off exactly a quarter' : 'Cut off exactly a third';
    const note = s.pin ? 'through the pin' : s.spin ? `it keeps turning${s.holes.length ? ', and the hole isn\'t paper' : ''}` : s.holes.length ? 'the hole isn\'t paper' : '';
    return note ? `${base}<small>${note}</small>` : s.target === 50 ? 'Cut it exactly in half' : base;
  }
  // a small picture of a shape, cut the way a result says (pieces pulled apart, cut line dashed)
  const ringPath = s => [s.outer, ...s.holes].map(r => 'M' + r.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z').join('');
  function turned(s, rot) { if (!rot) return s; const c = Math.cos(rot), sn = Math.sin(rot), tf = p => [200 + (p[0] - 200) * c - (p[1] - 200) * sn, 200 + (p[0] - 200) * sn + (p[1] - 200) * c]; return { ...s, outer: s.outer.map(tf), holes: s.holes.map(h => h.map(tf)) }; }
  function thumb(s, best) {
    let inner = '';
    if (!best) inner = `<path d="${ringPath(s)}" fill="${s.color}" fill-rule="evenodd" opacity=".5" stroke="rgba(0,0,0,.35)" stroke-width="5"/>`;
    else {
      const sh = turned(s, best.rot), n = [-best.d[1], best.d[0]];
      for (const sg of [1, -1]) { const pc = G.cutShape(sh, best.a, best.d, sg); if (pc.outer.length) inner += `<path transform="translate(${(n[0] * 16 * sg).toFixed(1)} ${(n[1] * 16 * sg).toFixed(1)})" d="${ringPath(pc)}" fill="${sg > 0 ? s.color : shade(s.color, -.15)}" fill-rule="evenodd" stroke="rgba(0,0,0,.4)" stroke-width="5"/>`; }
      inner += `<line x1="${best.a[0] - best.d[0] * 600}" y1="${best.a[1] - best.d[1] * 600}" x2="${best.a[0] + best.d[0] * 600}" y2="${best.a[1] + best.d[1] * 600}" stroke="#fff" stroke-width="5" stroke-dasharray="14 12"/>`;
    }
    if (s.pin) inner += `<circle cx="${s.pin[0]}" cy="${s.pin[1]}" r="12" fill="#1c2233"/><circle cx="${s.pin[0]}" cy="${s.pin[1]}" r="7" fill="#ffd23f"/>`;
    return `<svg viewBox="-20 -20 440 440" aria-hidden="true">${inner}</svg>`;
  }
  const starsFor = pts => pts >= 90 ? 3 : pts >= 70 ? 2 : pts >= 40 ? 1 : 0;
  const starRow = n => [0, 1, 2].map(i => i < n ? '★' : '<span class="off">★</span>').join('');
  // the shape as it stands now (spinning shapes turn about their middle until the cut)
  function current(s) {
    if (!s.spin) return s;
    const a = s.spin * (cut ? cutAt : t), c = Math.cos(a), sn = Math.sin(a), tf = p => [200 + (p[0] - 200) * c - (p[1] - 200) * sn, 200 + (p[0] - 200) * sn + (p[1] - 200) * c];
    return { ...s, outer: s.outer.map(tf), holes: s.holes.map(h => h.map(tf)) };
  }
  const errorFor = (pct, target) => target === 50 ? Math.abs(pct - 50) : Math.min(Math.abs(pct - target), Math.abs(100 - pct - target));
  const pointsFor = err => Math.max(0, Math.round(100 - err * 12));
  const gradeFor = err => err < .5 ? 'Surgical!' : err < 1.5 ? 'Sharp!' : err < 3 ? 'Nice cut' : err < 6 ? 'Close' : 'Wobbly';
  const squareFor = err => err < 1 ? '🟩' : err < 3 ? '🟨' : err < 6 ? '🟧' : '🟥';

  // ---------- flow ----------
  let lvl = 0;
  function begin(m, li) {
    mode = m;
    if (m === 'level') { lvl = li; shapes = [levelShape(li)]; }
    else { seed = m === 'daily' ? dayNumber() * 7919 + 13 : Math.floor(Math.random() * 1e9); shapes = makeRound(seed); }
    results = []; round = 0; startShape();
    $('slMenu').hidden = true; $('slEnd').hidden = true; $('slLvl').hidden = true;
  }
  function startShape() {
    cut = null; drag = null; t = 0; state = 'aim';
    const s = shapes[round];
    $('slSub').textContent = mode === 'level' ? `Level ${lvl + 1} of ${LEVELS.length}` : `${mode === 'daily' ? 'Daily #' + dayNumber() : 'Practice'} · shape ${round + 1} of ${N}`;
    $('slPrompt').innerHTML = promptFor(s);
    $('slHint').innerHTML = round === 0 ? 'Swipe across the shape. <b>One cut, no do-overs.</b>' : 'Swipe across the shape';
  }
  function doCut(a, b) {
    const s = shapes[round];
    let d = [b[0] - a[0], b[1] - a[1]]; const len = Math.hypot(d[0], d[1]); d = [d[0] / len, d[1] / len];
    if (s.pin) a = s.pin;
    cutAt = t;
    const sh = current(s), pct = G.split(sh, a, d);
    if (pct < .05 || pct > 99.95) { $('slHint').textContent = 'That missed the shape. Swipe right across it.'; Sound.tone(200, .15, 'sawtooth', .06); return; }
    const err = errorFor(pct, s.target);
    cut = { a, d, pct, err, at: performance.now(), pieces: [G.cutShape(sh, a, d, 1), G.cutShape(sh, a, d, -1)] };
    results.push({ err, pts: pointsFor(err), pct });
    state = 'cut';
    Sound.noise(.16, .45, 3200, .8, 'highpass'); Sound.noise(.08, .3, 1200, 2, 'bandpass', .05); haptic(14);
    const good = err < 1.5;
    setTimeout(() => { if (good) [0, 4, 7].forEach((s2, i) => Sound.tone(660 * Math.pow(2, s2 / 12), .25, 'triangle', .12, i * .07)); else Sound.tone(330, .2, 'triangle', .1); }, 250);
    if (mode === 'level') { levelDone(s); return; }
    $('slHint').innerHTML = `${gradeFor(err)} <b>${pointsFor(err)} pts</b> · tap for the ${round + 1 < N ? 'next shape' : 'results'}`;
  }
  function levelDone(s) {
    const pts = pointsFor(cut.err), lv = data.levels || (data.levels = {}), prev = lv[lvl];
    const mine = { pts, err: cut.err, a: cut.a, d: cut.d, rot: s.spin ? s.spin * cutAt : 0 };
    if (!prev || pts > prev.pts) lv[lvl] = mine;
    store('smidge/slice', data);
    $('slHint').innerHTML = `${gradeFor(cut.err)} <b>${pts} pts</b>`;
    $('slLvlT').textContent = gradeFor(cut.err);
    $('slLvlS').innerHTML = starRow(starsFor(pts));
    $('slLvlPic').innerHTML = thumb(s, mine);
    const a = cut.pct, b = 100 - cut.pct;
    $('slLvlP').textContent = `${a.toFixed(1)}% and ${b.toFixed(1)}%: off by ${cut.err.toFixed(1)}%, ${pts} points.` + (prev && prev.pts >= pts ? ` Your best here is ${prev.pts}.` : prev ? ' A new best.' : '');
    $('slLvlNext').textContent = lvl + 1 < LEVELS.length ? 'Next level' : 'All levels';
    setTimeout(() => { if (state === 'cut' && mode === 'level') $('slLvl').hidden = false; }, 1100);
  }
  function next() {
    if (round + 1 < N) { round++; startShape(); return; }
    finish();
  }
  function finish() {
    state = 'end';
    const total = results.reduce((a, r) => a + r.pts, 0), stars = total >= 450 ? 3 : total >= 350 ? 2 : total >= 200 ? 1 : 0;
    const day = dayNumber(), first = mode === 'daily' && data.daily[day] == null;
    if (mode === 'daily') data.daily[day] = Math.max(data.daily[day] || 0, total);
    data.best = Math.max(data.best || 0, total); store('smidge/slice', data);
    $('slTotal').textContent = `${total}`;
    $('slStars').innerHTML = [0, 1, 2].map(i => i < stars ? '★' : '<span class="off">★</span>').join('');
    $('slList').textContent = results.map((r, i) => `${squareFor(r.err)} ${i + 1}. off by ${r.err.toFixed(1)}%  ·  ${r.pts} pts`).join('\n');
    const share = `Smidge Slice ${mode === 'daily' ? '#' + day : '(practice)'} · ${total}/500\n${results.map(r => squareFor(r.err)).join('')}`;
    $('slShare').textContent = share;
    $('slNote').textContent = mode === 'daily' ? (first ? 'Today\'s score is saved. Come back tomorrow for new shapes.' : 'Replays don\'t change today\'s score, but your best still counts.') : `Best ever: ${data.best} of 500`;
    $('slEnd').hidden = false;
    [0, 4, 7, 12].slice(0, stars + 1).forEach((s2, i) => Sound.tone(523 * Math.pow(2, s2 / 12), .35, 'triangle', .16, i * .1));
  }
  function renderLevels() {
    const lv = data.levels || {}, first = LEVELS.findIndex((_, i) => !lv[i]);
    $('slGrid').innerHTML = LEVELS.map((L, i) => {
      const b = lv[i], sh = levelShape(i);
      return `<button class="sl-tile ${i === first ? 'cur' : ''} ${b ? 'done' : ''}" data-i="${i}" aria-label="Level ${i + 1}, ${tagFor(L)}${b ? `, best ${b.pts} points` : ''}">` +
        `<span class="sl-pic">${thumb(sh, b)}</span><span class="sl-n">${i + 1}</span>` +
        `<span class="sl-s">${b ? `<b>${b.pts}</b> pts` : tagFor(L)}</span>${b ? `<span class="sl-st">${'★'.repeat(starsFor(b.pts))}</span>` : ''}</button>`;
    }).join('');
    $('slGrid').querySelectorAll('.sl-tile').forEach(t => t.onclick = () => { Sound.audio(); begin('level', +t.dataset.i); });
    const done = LEVELS.filter((_, i) => lv[i]).length, total = LEVELS.reduce((a, _, i) => a + (lv[i] ? lv[i].pts : 0), 0);
    $('slLvlSum').textContent = done ? `${done} of ${LEVELS.length} played · ${total} points` : `${LEVELS.length} shapes, one cut each`;
  }
  function showMenu() {
    renderLevels(); $('slLvl').hidden = true;
    state = 'menu'; const day = dayNumber(), done = data.daily[day];
    $('slDailyBtn').textContent = done != null ? `Daily #${day} again` : `Play daily #${day}`;
    $('slMenuNote').textContent = done != null ? `Today's score: ${done} of 500. Best ever: ${data.best}.` : data.best ? `Best ever: ${data.best} of 500.` : 'Five shapes. One swipe each. 100 points for a perfect cut.';
    $('slMenu').hidden = false; $('slEnd').hidden = true;
    $('slSub').textContent = 'Cut it fair'; $('slPrompt').innerHTML = ''; $('slHint').textContent = '';
    if (!shapes.length) shapes = makeRound(dayNumber() * 7919 + 13);
  }

  // ---------- drawing ----------
  function resize() { DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; }
  function view() { const top = 150, bot = 64, s = Math.min(W / 430, (H - top - bot) / 430); return { s, ox: W / 2 - 200 * s, oy: top + (H - top - bot) / 2 - 200 * s }; }
  const toWorld = (v, e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left - v.ox) / v.s, (e.clientY - r.top - v.oy) / v.s]; };
  function path(s) { ctx.beginPath(); for (const ringPts of [s.outer, ...s.holes]) { ringPts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); } }
  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  let colors = {};
  function readColors() { colors = { mat: css('--mat'), mat2: css('--mat-2'), line: css('--mat-line'), bg: css('--mat-bg') }; }
  function draw() {
    const v = view();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = colors.bg; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(DPR * v.s, 0, 0, DPR * v.s, DPR * v.ox, DPR * v.oy);
    // cutting mat
    ctx.fillStyle = colors.mat; roundRect(-15, -15, 430, 430, 22); ctx.fill();
    ctx.save(); roundRect(-15, -15, 430, 430, 22); ctx.clip();
    ctx.strokeStyle = colors.line;
    for (let i = -10; i <= 420; i += 10) { ctx.globalAlpha = i % 50 === 0 ? .32 : .12; ctx.lineWidth = i % 50 === 0 ? 1.4 : .8; ctx.beginPath(); ctx.moveTo(i, -15); ctx.lineTo(i, 415); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-15, i); ctx.lineTo(415, i); ctx.stroke(); }
    ctx.globalAlpha = .28; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-15, 300); ctx.lineTo(100, 415); ctx.stroke(); ctx.beginPath(); ctx.arc(415, -15, 120, Math.PI / 2, Math.PI); ctx.stroke();
    ctx.globalAlpha = .5; ctx.fillStyle = colors.line; ctx.font = '700 9px Nunito, sans-serif'; ctx.textAlign = 'center';
    for (let i = 0; i <= 400; i += 50) { ctx.fillText(String(i / 10), i, -5); }
    ctx.globalAlpha = 1; ctx.restore();
    const s = shapes[round]; if (!s || state === 'menu') return;
    const sh = current(s);
    if (!cut) {
      ctx.save(); ctx.translate(3, 5); path(sh); ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fill('evenodd'); ctx.restore();
      path(sh); ctx.fillStyle = s.color; ctx.fill('evenodd'); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.stroke();
    } else {
      const k = Math.min(1, (performance.now() - cut.at) / 380), sep = 12 * (1 - Math.pow(1 - k, 3)), n = [-cut.d[1], cut.d[0]];
      cut.pieces.forEach((pc, i) => {
        if (!pc.outer.length) return;
        const sg = i === 0 ? 1 : -1;
        ctx.save(); ctx.translate(n[0] * sep * sg, n[1] * sep * sg);
        ctx.save(); ctx.translate(3, 5); path(pc); ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fill('evenodd'); ctx.restore();
        path(pc); ctx.fillStyle = i === 0 ? s.color : shade(s.color, -.12); ctx.fill('evenodd'); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.stroke();
        ctx.restore();
      });
      // labels
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      cut.pieces.forEach((pc, i) => {
        if (!pc.outer.length) return;
        const sg = i === 0 ? 1 : -1, c = G.centroid(pc.outer), pct = i === 0 ? cut.pct : 100 - cut.pct;
        const x = c[0] + n[0] * sep * sg * 2.5, y = c[1] + n[1] * sep * sg * 2.5;
        ctx.globalAlpha = k; ctx.font = `30px ${css('--display')}`; ctx.lineWidth = 6; ctx.strokeStyle = '#1c2233'; ctx.strokeText(pct.toFixed(1) + '%', x, y); ctx.fillStyle = '#fff'; ctx.fillText(pct.toFixed(1) + '%', x, y); ctx.globalAlpha = 1;
      });
    }
    if (s.pin) { const p = s.pin; ctx.fillStyle = '#1c2233'; ctx.beginPath(); ctx.arc(p[0], p[1], 7, 0, 7); ctx.fill(); ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(p[0], p[1], 4.5, 0, 7); ctx.fill(); }
    // the cut line: the swipe while dragging, the real cut after
    let line = null;
    if (drag && drag.b && state === 'aim') { const a = s.pin || drag.a, d = [drag.b[0] - drag.a[0], drag.b[1] - drag.a[1]], l = Math.hypot(d[0], d[1]); if (l > 8) line = { a, d: [d[0] / l, d[1] / l], dash: true }; }
    if (cut) line = { a: cut.a, d: cut.d, dash: false };
    if (line) {
      ctx.save(); roundRect(-15, -15, 430, 430, 22); ctx.clip();
      ctx.strokeStyle = line.dash ? '#fff' : 'rgba(255,255,255,.9)'; ctx.lineWidth = line.dash ? 2.5 : 1.5; ctx.setLineDash(line.dash ? [9, 7] : [3, 5]);
      ctx.beginPath(); ctx.moveTo(line.a[0] - line.d[0] * 700, line.a[1] - line.d[1] * 700); ctx.lineTo(line.a[0] + line.d[0] * 700, line.a[1] + line.d[1] * 700); ctx.stroke();
      ctx.restore(); ctx.setLineDash([]);
    }
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; r *= 1 + f; g *= 1 + f; b *= 1 + f; return `rgb(${r | 0},${g | 0},${b | 0})`; }
  function frame(now) {
    if (active) { const dt = Math.min(.05, (now - last) / 1000); if (state === 'aim') t += dt; draw(); }
    last = now; requestAnimationFrame(frame);
  }

  // ---------- input ----------
  cv.addEventListener('pointerdown', e => {
    if (!active) return; e.preventDefault(); Sound.audio();
    if (state === 'cut') { if (performance.now() - cut.at > 350) { if (mode === 'level') $('slLvl').hidden = false; else next(); } return; }
    if (state !== 'aim') return;
    const v = view(); drag = { a: toWorld(v, e), b: null };
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  }, { passive: false });
  cv.addEventListener('pointermove', e => { if (drag && state === 'aim') drag.b = toWorld(view(), e); });
  cv.addEventListener('pointerup', e => {
    if (!drag || state !== 'aim') { drag = null; return; }
    const b = toWorld(view(), e), a = drag.a; drag = null;
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 30) { $('slHint').textContent = 'Swipe further: drag right across the shape.'; return; }
    doCut(a, b);
  });
  cv.addEventListener('pointercancel', () => { drag = null; });
  $('slLvlClose').onclick = () => { $('slLvl').hidden = true; $('slHint').innerHTML = 'Tap the board for your result again'; Sound.tone(520, .05, 'triangle', .06); };
  $('slLvl').addEventListener('click', e => { if (e.target === $('slLvl')) $('slLvlClose').click(); });
  $('slLvlRetry').onclick = () => { Sound.audio(); begin('level', lvl); };
  $('slLvlNext').onclick = () => { Sound.audio(); if (lvl + 1 < LEVELS.length) begin('level', lvl + 1); else showMenu(); };
  $('slLvlList').onclick = () => { Sound.audio(); showMenu(); };
  $('slDailyBtn').onclick = () => { Sound.audio(); begin('daily'); };
  $('slPracticeBtn').onclick = () => { Sound.audio(); begin('practice'); };
  $('slAgain').onclick = () => { Sound.audio(); begin(mode); };
  $('slMenuBtn').onclick = () => { Sound.audio(); showMenu(); };
  $('slCopy').onclick = e => { Sound.audio(); copyText($('slShare').textContent, e.currentTarget); };
  addEventListener('resize', () => { if (active) resize(); });
  requestAnimationFrame(frame);
  return {
    enter() { active = true; resize(); readColors(); showMenu(); },
    leave() { active = false; drag = null; },
    stats() { const lv = data.levels || {}; return { best: data.best || 0, today: data.daily[dayNumber()], levels: LEVELS.filter((_, i) => lv[i]).length, total: LEVELS.length }; },
    _debug: { makeRound, G, LEVELS, levelShape },
  };
})();
