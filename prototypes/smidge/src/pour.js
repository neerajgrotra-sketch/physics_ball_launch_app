// Pour: hold to pour, let go on the line. Narrow parts of a glass fill fast, and what is already falling still lands
// after you let go. Five glasses a round: a straight tumbler, a cone, a flask with a neck, two lines, and a leaky glass.
const PourPhys = (() => {
  const GH = 300, N = 400, FALL = .26;
  const PROFILES = {
    tumbler: (u, p) => 56 + 16 * u * p.a,
    cone: (u, p) => 10 + (88 + 20 * p.a) * u,
    flask: (u, p) => u < .62 ? 34 + (52 + 14 * p.a) * Math.sin(Math.PI * Math.min(1, u / .62)) : 22,
    hourglass: (u, p) => 26 + (52 + 12 * p.a) * Math.pow(Math.abs(2 * u - 1), 1.15),
    vase: (u, p) => 54 + 22 * Math.sin(u * Math.PI * 2 * (1.1 + .4 * p.a) + .5),
  };
  // area below each height (u in 0..1 of the glass), so a level can be found from how much has landed
  function table(shape) {
    const w = PROFILES[shape.kind], cum = new Float64Array(N + 1);
    for (let i = 1; i <= N; i++) { const u = (i - .5) / N; cum[i] = cum[i - 1] + 2 * w(u, shape) * GH / N; }
    return cum;
  }
  function levelFor(cum, area) {
    if (area <= 0) return 0; if (area >= cum[N]) return 1 + (area - cum[N]) / cum[N];
    let lo = 0, hi = N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < area) lo = m; else hi = m; }
    return (lo + (area - cum[lo]) / (cum[hi] - cum[lo])) / N;
  }
  return { GH, FALL, PROFILES, table, levelFor };
})();

const Pour = (() => {
  const $ = id => document.getElementById(id);
  const P = PourPhys, N = 5, LIQ = ['#ff9f1c', '#d6336c', '#7cc242', '#6b3e26', '#f3f0e8'];
  const cv = $('poCanvas'), ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1, active = false, last = 0;
  let mode = 'daily', glasses = [], gi = 0, results = [], state = 'menu', g = null;
  let data = storeObj('smidge/pour', { daily: {}, best: 0 });

  function makeRound(seed) {
    const r = rng(seed), plan = [['tumbler'], ['cone'], ['flask', 'vase'], ['hourglass', 'vase', 'tumbler'], ['tumbler', 'cone']];
    return plan.map((kinds, i) => {
      const kind = kinds[Math.floor(r() * kinds.length)], shape = { kind, a: r() };
      const cum = P.table(shape), full = cum[cum.length - 1];
      const targets = i === 3 ? [.3 + r() * .15, .65 + r() * .17] : [.45 + r() * .4];
      return { shape, cum, targets, rate: full / (3.6 - i * .35 - r() * .3), leak: i === 4 ? full * (.05 + r() * .03) : 0, color: LIQ[i] };
    });
  }
  // levels: one glass each, getting harder (faster pours, awkward shapes, two lines, leaks)
  const LEVELS = [
    ['tumbler', 4.2], ['tumbler', 3.6], ['tumbler', 3.0], ['cone', 4.0], ['cone', 3.4], ['cone', 2.8], ['flask', 3.8], ['flask', 3.2],
    ['vase', 3.6], ['hourglass', 3.6], ['vase', 3.0], ['hourglass', 2.9], ['tumbler', 3.4, 'two'], ['cone', 3.2, 'two'], ['flask', 3.0, 'two'],
    ['tumbler', 3.4, 'leak'], ['cone', 3.2, 'leak'], ['vase', 3.0, 'leak'], ['hourglass', 2.8, 'leak'], ['flask', 2.6, 'two'],
  ].map(([kind, secs, tw], i) => ({ kind, secs, two: tw === 'two', leak: tw === 'leak', seed: 6301 + i * 29 }));
  function levelGlass(i) {
    const L = LEVELS[i], r = rng(L.seed), shape = { kind: L.kind, a: r() }, cum = P.table(shape), full = cum[cum.length - 1];
    const targets = L.two ? [.28 + r() * .15, .62 + r() * .2] : [.4 + r() * .45];
    return { shape, cum, targets, rate: full / L.secs, leak: L.leak ? full * (.05 + r() * .03) : 0, color: LIQ[i % LIQ.length] };
  }
  const tagFor = L => L.two ? 'Two lines' : L.leak ? 'Leaky' : L.kind[0].toUpperCase() + L.kind.slice(1);
  const starsFor = err => err <= 1 ? 3 : err <= 2.5 ? 2 : 1;
  const starRow = n => [0, 1, 2].map(i => i < n ? '★' : '<span class="off">★</span>').join('');
  // a small picture of a glass: the lines, and (once played) how full you left it
  function thumb(gl, rec) {
    const w = u => P.PROFILES[gl.shape.kind](u, gl.shape), y = u => 500 - u * P.GH, side = (sg, a, b) => { const pts = []; for (let i = 0; i <= 40; i++) { const u = a + (b - a) * i / 40; pts.push(`${(200 + sg * w(u)).toFixed(1)},${y(u).toFixed(1)}`); } return pts; };
    let svg = '';
    if (rec) { const lv = Math.min(1, rec.level); if (lv > 0) svg += `<polygon points="${side(-1, 0, lv).concat(side(1, lv, 0)).join(' ')}" fill="${gl.color}"/>`; }
    svg += `<polyline points="${side(-1, 0, 1).join(' ')}" fill="none" stroke="#1c2233" stroke-width="7" stroke-linejoin="round"/><polyline points="${side(1, 0, 1).join(' ')}" fill="none" stroke="#1c2233" stroke-width="7" stroke-linejoin="round"/>`;
    svg += `<line x1="${200 - w(0) - 8}" y1="504" x2="${200 + w(0) + 8}" y2="504" stroke="#1c2233" stroke-width="10" stroke-linecap="round"/>`;
    gl.targets.forEach((tu, i) => { const ok = rec ? (rec.errs[i] ?? 99) <= 1.5 : null, col = ok == null ? '#ff3b30' : ok ? '#1f9e5a' : '#ff3b30', ww = w(tu); svg += `<path d="M${200 - ww - 24} ${y(tu)} H${200 - ww + 10} M${200 + ww - 10} ${y(tu)} H${200 + ww + 24}" stroke="${col}" stroke-width="8"/>`; });
    if (gl.leak) svg += `<circle cx="${200 + w(.03) + 10}" cy="492" r="6" fill="${gl.color}"/>`;
    return `<svg viewBox="40 170 320 350" aria-hidden="true">${svg}</svg>`;
  }
  let lvl = 0;
  function begin(m, li) {
    mode = m;
    if (m === 'level') { lvl = li; glasses = [levelGlass(li)]; }
    else glasses = makeRound(m === 'daily' ? dayNumber() * 6151 + 3 : Math.floor(Math.random() * 1e9));
    gi = 0; results = []; startGlass(); $('poMenu').hidden = true; $('poEnd').hidden = true; $('poLvl').hidden = true;
  }
  function startGlass() {
    const gl = glasses[gi];
    g = { ...gl, area: 0, air: [], t: 0, pouring: false, ti: 0, errs: [], settle: 0, pours: 0, glug: 0, landed: 0, spill: 0 };
    state = 'aim';
    $('poSub').textContent = mode === 'level' ? `Level ${lvl + 1} of ${LEVELS.length}` : `${mode === 'daily' ? 'Daily #' + dayNumber() : 'Practice'} · glass ${gi + 1} of ${glasses.length}`;
    $('poPrompt').innerHTML = gl.targets.length > 1 ? 'Fill to the lower line, then the top one<small>two pours</small>' : gl.leak ? 'Fill to the line<small>it leaks: the level is checked a second after you stop</small>' : 'Fill to the line';
    $('poHint').innerHTML = gi === 0 ? 'Hold anywhere to pour, let go on the line. <b>One pour.</b>' : 'Hold to pour, let go on the line';
  }
  const level = () => P.levelFor(g.cum, g.area);
  const ptsFor = err => Math.max(0, Math.round(100 - err * 20));
  const grade = err => err < .5 ? 'Bang on!' : err < 1.5 ? 'Steady pour' : err < 3 ? 'Nearly' : 'Splash';
  const sq = err => err < 1 ? '🟩' : err < 2.5 ? '🟨' : err < 5 ? '🟧' : '🟥';
  function step(dt) {
    if (!g || (state !== 'aim' && state !== 'pour' && state !== 'settle')) return;
    g.t += dt;
    if (g.pouring) g.air.push({ at: g.t + P.FALL, a: g.rate * dt });
    let land = 0; while (g.air.length && g.air[0].at <= g.t) land += g.air.shift().a;
    g.area += land; g.landed = land / Math.max(dt, 1e-3);
    if (g.leak && g.area > 0) g.area = Math.max(0, g.area - g.leak * Math.sqrt(Math.min(1, level())) * dt);
    const full = g.cum[g.cum.length - 1];
    if (g.area > full) { g.spill += g.area - full; g.area = full; }
    if (land > 0) { g.glug -= dt; if (g.glug <= 0) { g.glug = .07; Sound.noise(.09, .16, 500 + Math.min(1, level()) * 2000, 4, 'bandpass'); } }
    if (state === 'settle' && !g.air.length) {
      g.settle += dt;
      if (g.settle >= (g.leak ? 1 : .5)) {
        const err = g.spill > 0 ? 25 : Math.abs(level() - g.targets[g.ti]) * 100;
        g.errs.push(err); g.ti++; g.lastLevel = level(); (g.meas = g.meas || []).push(Math.min(1, level()));
        if (g.ti < g.targets.length) { state = 'aim'; $('poHint').innerHTML = `${grade(err)} · now the top line`; Sound.tone(660, .15, 'triangle', .1); }
        else finishGlass();
      }
    }
  }
  function finishGlass() {
    const err = g.errs.reduce((a, b) => a + b, 0) / g.errs.length, pts = ptsFor(err);
    results.push({ err, pts }); state = 'shown';
    if (mode === 'level') return levelDone(err);
    if (mode !== 'level') $('poHint').innerHTML = `${g.spill > 0 ? 'Spilled!' : grade(err)} · off by ${err.toFixed(1)}% · <b>${pts} pts</b> · tap for the ${gi + 1 < glasses.length ? 'next glass' : 'results'}`;
    if (err < 1.5) [0, 4, 7].forEach((s, i) => Sound.tone(660 * Math.pow(2, s / 12), .25, 'triangle', .12, i * .07)); else Sound.tone(300, .2, 'triangle', .1);
    haptic(err < 1.5 ? 30 : 12);
  }
  function levelDone(err) {
    const lv = data.levels || (data.levels = {}), prev = lv[lvl], rec = { err, errs: g.errs.slice(), level: g.lastLevel, spill: g.spill > 0 };
    const better = !prev || err < prev.err; if (better) lv[lvl] = rec; store('smidge/pour', data);
    const st = starsFor(err), gl = glasses[0];
    $('poHint').innerHTML = `${g.spill > 0 ? 'Spilled!' : grade(err)} <b>off by ${err.toFixed(1)}%</b> ${'★'.repeat(st)}`;
    $('poLvlT').textContent = g.spill > 0 ? 'Spilled!' : grade(err);
    $('poLvlS').innerHTML = starRow(st);
    $('poLvlPic').innerHTML = thumb(gl, rec);
    const lines = gl.targets.length > 1 ? `Lines at ${gl.targets.map(t => Math.round(t * 100) + '%').join(' and ')}` : `Line at ${(gl.targets[0] * 100).toFixed(0)}% of the glass`;
    $('poLvlP').innerHTML = `<span class="sl-split">${g.spill > 0 ? 'Spilled' : 'Off by ' + err.toFixed(1) + '%'}</span>${lines}; you stopped at ${(g.meas || [g.lastLevel]).map(m => (Math.min(1, m) * 100).toFixed(1) + '%').join(' and ')}.` + (prev && !better ? ` Your best here: off by ${prev.err.toFixed(1)}%.` : prev ? ' A new best.' : '');
    $('poLvlNext').textContent = lvl + 1 < LEVELS.length ? 'Next level' : 'All levels';
    setTimeout(() => { if (state === 'shown' && mode === 'level') $('poLvl').hidden = false; }, 900);
  }
  function renderLevels() {
    const lv = data.levels || {}, first = LEVELS.findIndex((_, i) => !lv[i]);
    $('poGrid').innerHTML = LEVELS.map((L, i) => { const b = lv[i];
      return `<button class="sl-tile ${i === first ? 'cur' : ''}" data-i="${i}" aria-label="Level ${i + 1}, ${tagFor(L)}${b ? `, best off by ${b.err.toFixed(1)}%, ${starsFor(b.err)} stars` : ''}"><span class="sl-pic po">${thumb(levelGlass(i), b)}</span><span class="sl-n">${i + 1}</span>` +
        `<span class="sl-s">${b ? `<b>${b.spill ? 'spilled' : '±' + b.err.toFixed(1) + '%'}</b>` : tagFor(L)}</span>${b ? `<span class="sl-st">${'★'.repeat(starsFor(b.err))}</span>` : ''}</button>`; }).join('');
    $('poGrid').querySelectorAll('.sl-tile').forEach(t => t.onclick = () => { Sound.audio(); begin('level', +t.dataset.i); });
    const done = LEVELS.filter((_, i) => lv[i]).length, stars = LEVELS.reduce((a, _, i) => a + (lv[i] ? starsFor(lv[i].err) : 0), 0);
    $('poLvlSum').textContent = done ? `${done} of ${LEVELS.length} played · ★ ${stars} of ${LEVELS.length * 3}` : `${LEVELS.length} glasses, one pour each`;
  }
  function next() { if (gi + 1 < glasses.length) { gi++; startGlass(); } else finish(); }
  function finish() {
    state = 'end';
    const total = results.reduce((a, r) => a + r.pts, 0), stars = total >= 425 ? 3 : total >= 320 ? 2 : total >= 180 ? 1 : 0, day = dayNumber(), first = mode === 'daily' && data.daily[day] == null;
    if (mode === 'daily') data.daily[day] = Math.max(data.daily[day] || 0, total);
    data.best = Math.max(data.best || 0, total); store('smidge/pour', data);
    $('poTotal').textContent = total;
    $('poStars').innerHTML = [0, 1, 2].map(i => i < stars ? '★' : '<span class="off">★</span>').join('');
    $('poList').textContent = results.map((r, i) => `${sq(r.err)} Glass ${i + 1}: off by ${r.err.toFixed(1)}% · ${r.pts} pts`).join('\n');
    $('poShare').textContent = `Smidge Pour ${mode === 'daily' ? '#' + day : '(practice)'} · ${total}/500\n${results.map(r => sq(r.err)).join('')}`;
    $('poNote').textContent = mode === 'daily' ? (first ? 'Today\'s score is saved. New glasses tomorrow.' : 'Replays don\'t change today\'s score.') : `Best ever: ${data.best} of 500`;
    $('poEnd').hidden = false;
  }
  function showMenu() {
    renderLevels(); $('poLvl').hidden = true;
    state = 'menu'; const day = dayNumber(), done = data.daily[day];
    if (!glasses.length) { glasses = makeRound(day * 6151 + 3); g = { ...glasses[0], area: 0, air: [], t: 0, ti: 0, errs: [], spill: 0 }; }
    $('poDailyBtn').textContent = done != null ? `Daily #${day} again` : `Play daily #${day}`;
    $('poMenuNote').textContent = done != null ? `Today: ${done} of 500. Best ever: ${data.best}.` : data.best ? `Best ever: ${data.best} of 500.` : 'Five glasses. 100 points for stopping right on the line.';
    $('poMenu').hidden = false; $('poEnd').hidden = true; $('poSub').textContent = 'Steady hands'; $('poPrompt').innerHTML = ''; $('poHint').textContent = '';
  }

  // ---------- drawing ----------
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let C = {};
  function readColors() { for (const k of ['wall', 'tile', 'counter', 'counter2', 'glass']) C[k] = css('--po-' + k); }
  function resize() { DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; }
  function view() { const top = 140, bot = 70, s = Math.min(W / 420, (H - top - bot) / 520); return { s, ox: W / 2 - 200 * s, oy: top + (H - top - bot) / 2 - 270 * s }; }
  function draw() {
    const v = view();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = C.wall; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = C.tile; ctx.lineWidth = 1.5;
    const tw = 46 * v.s, th = 23 * v.s;
    for (let y = 0, row = 0; y < H; y += th, row++) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); for (let x = (row % 2) * tw / 2; x < W; x += tw) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + th); ctx.stroke(); } }
    ctx.setTransform(DPR * v.s, 0, 0, DPR * v.s, DPR * v.ox, DPR * v.oy);
    // counter
    const base = 500;
    ctx.fillStyle = C.counter; ctx.fillRect(-600, base + 6, 1600, 400); ctx.fillStyle = C.counter2; ctx.fillRect(-600, base + 6, 1600, 10);
    if (!g) return;
    const w = u => P.PROFILES[g.shape.kind](u, g.shape), y = u => base - u * P.GH, steps = 80;
    const side = (sgn, from, to) => { const pts = []; for (let i = 0; i <= steps; i++) { const u = from + (to - from) * i / steps; pts.push([200 + sgn * w(u), y(u)]); } return pts; };
    // liquid
    const lv = Math.min(1, level()), L = side(-1, 0, lv), R = side(1, lv, 0);
    if (lv > 0) {
      const wob = (state === 'pour' || g.landed > 0) ? Math.sin(g.t * 18) * 2 : Math.sin(g.t * 3) * .6;
      ctx.beginPath(); L.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      ctx.quadraticCurveTo(200, y(lv) + wob, R[0][0], R[0][1]); R.forEach(p => ctx.lineTo(p[0], p[1])); ctx.closePath();
      ctx.fillStyle = g.color; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(200 - w(lv) + 4, y(lv) + 2, 2 * w(lv) - 8, 4);
      for (let i = 0; i < 6; i++) { const u = ((g.t * .15 + i * .17) % 1) * lv, bx = 200 + Math.sin(i * 7.1) * w(u) * .6; ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(bx, y(u), 2.2, 0, 7); ctx.fill(); }
    }
    // glass
    const outL = side(-1, 0, 1), outR = side(1, 1, 0);
    ctx.beginPath(); outL.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); outR.forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.fillStyle = C.glass; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#1c2233'; ctx.lineJoin = 'round';
    ctx.beginPath(); outL.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
    ctx.beginPath(); outR.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(200 - w(0) - 6, base + 4); ctx.lineTo(200 + w(0) + 6, base + 4); ctx.lineWidth = 8; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i <= 20; i++) { const u = .15 + .6 * i / 20; const p = [200 - w(u) + 9, y(u)]; i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } ctx.stroke();
    // lines to fill to
    g.targets.forEach((tu, i) => {
      const done = i < g.errs.length, col = done ? (g.errs[i] < 1.5 ? '#2fbf71' : '#ff5a4f') : '#ff3b30', yy = y(tu), ww = w(tu);
      ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(200 - ww - 16, yy); ctx.lineTo(200 - ww + 10, yy); ctx.moveTo(200 + ww - 10, yy); ctx.lineTo(200 + ww + 16, yy); ctx.stroke();
      ctx.setLineDash([5, 6]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(200 - ww + 10, yy); ctx.lineTo(200 + ww - 10, yy); ctx.stroke(); ctx.setLineDash([]);
    });
    if (g.leak && lv > 0) { const d = (g.t * 3) % 1; ctx.fillStyle = g.color; ctx.beginPath(); ctx.arc(200 + w(.03) + 4 + d * 8, base - 6 + d * 18, 3, 0, 7); ctx.fill(); }
    // jug and stream
    const tilt = g.pouring ? .95 : .3, jx = 168, jy = 112;
    ctx.save(); ctx.translate(jx, jy); ctx.rotate(tilt);
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.strokeStyle = '#1c2233'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(-60, -50); ctx.lineTo(10, -50); ctx.lineTo(18, -60); ctx.lineTo(16, 30); ctx.lineTo(-60, 30); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = g.color; ctx.globalAlpha = .85; ctx.fillRect(-57, -20, 70, 47); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(-72, -10, 18, Math.PI * .5, Math.PI * 1.5); ctx.stroke();
    ctx.restore();
    if (g.air.length) {
      // the stream: from the spout down to the surface; after letting go its tail falls for FALL seconds
      const top0 = 168, surf = y(lv), f = k => top0 + Math.max(0, Math.min(1, k)) * (surf - top0);
      const yTop = g.pouring ? top0 : f((g.t - g.releaseT) / P.FALL), yBot = f((g.t - g.pourT) / P.FALL);
      ctx.strokeStyle = g.color; ctx.lineCap = 'round'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(200, yTop); ctx.lineTo(200, yBot); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(198, yTop); ctx.lineTo(198, yBot); ctx.stroke();
    }
  }
  function frame(now) { const dt = Math.min(.05, (now - last) / 1000); last = now; if (active) { step(dt); draw(); } requestAnimationFrame(frame); }

  // ---------- input ----------
  cv.addEventListener('pointerdown', e => {
    if (!active) return; e.preventDefault(); Sound.audio();
    if (state === 'shown') { if (mode === 'level') $('poLvl').hidden = false; else next(); return; }
    if (state !== 'aim') return;
    g.pouring = true; state = 'pour'; g.pours++; g.pourT = g.t;
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    Sound.noise(.15, .2, 1200, 1); haptic(6);
  }, { passive: false });
  const stop = () => { if (state === 'pour') { g.pouring = false; g.releaseT = g.t; state = 'settle'; g.settle = 0; } };
  cv.addEventListener('pointerup', stop); cv.addEventListener('pointercancel', stop);
  $('poLvlClose').onclick = () => { $('poLvl').hidden = true; $('poHint').innerHTML = 'Tap the glass for your result again'; Sound.tone(520, .05, 'triangle', .06); };
  $('poLvl').addEventListener('click', e => { if (e.target === $('poLvl')) $('poLvlClose').click(); });
  $('poLvlRetry').onclick = () => { Sound.audio(); begin('level', lvl); };
  $('poLvlNext').onclick = () => { Sound.audio(); if (lvl + 1 < LEVELS.length) begin('level', lvl + 1); else showMenu(); };
  $('poLvlList').onclick = () => { Sound.audio(); showMenu(); };
  $('poDailyBtn').onclick = () => { Sound.audio(); begin('daily'); };
  $('poPracticeBtn').onclick = () => { Sound.audio(); begin('practice'); };
  $('poAgain').onclick = () => { Sound.audio(); begin(mode); };
  $('poMenuBtn').onclick = () => { Sound.audio(); showMenu(); };
  $('poCopy').onclick = e => { Sound.audio(); copyText($('poShare').textContent, e.currentTarget); };
  addEventListener('resize', () => { if (active) resize(); });
  requestAnimationFrame(frame);
  return {
    enter() { active = true; resize(); readColors(); showMenu(); },
    leave() { active = false; if (g) g.pouring = false; if (state === 'pour') state = 'settle'; },
    stats() { const lv = data.levels || {}; return { best: data.best || 0, today: data.daily[dayNumber()], levels: LEVELS.filter((_, i) => lv[i]).length, total: LEVELS.length }; },
  };
})();
