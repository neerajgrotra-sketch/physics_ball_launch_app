// Eyeball: judge by eye. Six quick tasks a round: find the middle, make a right angle, find the centre, split an angle,
// make a square, find the balance point. Drag (or touch) and let go to lock it in; then the true answer is shown.
const EyeGeo = (() => {
  const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const ang = (o, p) => Math.atan2(p[1] - o[1], p[0] - o[0]);
  const angDiff = (a, b) => { let d = (a - b) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; };
  function make(kind, r) {
    const R = (a, b) => a + r() * (b - a);
    if (kind === 'mid') { const L = R(220, 320), a = R(-.6, .6) + (r() < .5 ? 0 : Math.PI / 2); const c = [200 + R(-30, 30), 200 + R(-30, 30)]; return { kind, a: [c[0] - Math.cos(a) * L / 2, c[1] - Math.sin(a) * L / 2], b: [c[0] + Math.cos(a) * L / 2, c[1] + Math.sin(a) * L / 2] }; }
    if (kind === 'right') { const v = [R(110, 170), R(250, 300)], a = R(-.5, .3); const h = a - Math.PI / 2 - R(.5, .9) * (r() < .5 ? 1 : -1); return { kind, v, a, handle: [v[0] + Math.cos(h) * 170, v[1] + Math.sin(h) * 170] }; }
    if (kind === 'centre') { const rr = R(95, 150); return { kind, c: [200 + R(-40, 40), 200 + R(-40, 40)], r: rr, arc: R(.55, .8) * Math.PI * 2, start: r() * Math.PI * 2 }; }
    if (kind === 'bisect') { const v = [R(90, 130), R(240, 300)], a1 = R(-1.3, -.9), span = R(.8, 1.9), a2 = a1 + span; const h = a1 + span * (r() < .5 ? R(.12, .3) : R(.7, .88)); return { kind, v, a1, a2, handle: [v[0] + Math.cos(h) * 200, v[1] + Math.sin(h) * 200] }; }
    if (kind === 'square') { const w = R(130, 220), x0 = 200 - w / 2, y0 = R(300, 330); return { kind, x0, y0, w, h: w * (r() < .5 ? R(.35, .6) : R(1.35, 1.6)) }; }
    const pts = [[R(60, 140), R(260, 330)], [R(260, 340), R(240, 330)], [R(150, 260), R(70, 140)]];
    return { kind: 'balance', pts };
  }
  // the true answer and how far off a guess is (err in %, or in degrees for angles)
  function judge(t, guess) {
    if (t.kind === 'mid') { const m = [(t.a[0] + t.b[0]) / 2, (t.a[1] + t.b[1]) / 2]; return { ans: m, err: d2(m, guess) / d2(t.a, t.b) * 100, unit: '% of the length' }; }
    if (t.kind === 'right') { const a = ang(t.v, guess), want = [t.a - Math.PI / 2, t.a + Math.PI / 2], d = Math.min(...want.map(w => Math.abs(angDiff(a, w)))); const best = want.reduce((p, w) => Math.abs(angDiff(a, w)) < Math.abs(angDiff(a, p)) ? w : p); return { ans: [t.v[0] + Math.cos(best) * 170, t.v[1] + Math.sin(best) * 170], err: d * 180 / Math.PI, unit: '°', deg: true }; }
    if (t.kind === 'centre') return { ans: t.c, err: d2(t.c, guess) / t.r * 100, unit: '% of the radius' };
    if (t.kind === 'bisect') { const m = (t.a1 + t.a2) / 2, a = ang(t.v, guess); return { ans: [t.v[0] + Math.cos(m) * 200, t.v[1] + Math.sin(m) * 200], err: Math.abs(angDiff(a, m)) * 180 / Math.PI, unit: '°', deg: true }; }
    if (t.kind === 'square') { const h = t.y0 - guess[1]; return { ans: [200, t.y0 - t.w], err: Math.abs(h - t.w) / t.w * 100, unit: '% of the side' }; }
    const c = [(t.pts[0][0] + t.pts[1][0] + t.pts[2][0]) / 3, (t.pts[0][1] + t.pts[1][1] + t.pts[2][1]) / 3];
    const area = Math.abs((t.pts[1][0] - t.pts[0][0]) * (t.pts[2][1] - t.pts[0][1]) - (t.pts[2][0] - t.pts[0][0]) * (t.pts[1][1] - t.pts[0][1])) / 2;
    return { ans: c, err: d2(c, guess) / Math.sqrt(area) * 100, unit: '% of its size' };
  }
  const points = j => Math.max(0, Math.round(100 - j.err * (j.deg ? 6 : 8)));
  return { make, judge, points };
})();

const Eyeball = (() => {
  const $ = id => document.getElementById(id);
  const E = EyeGeo, KINDS = ['mid', 'right', 'centre', 'bisect', 'square', 'balance'];
  const PROMPT = { mid: 'Tap the exact middle of the line', right: 'Swing the arm to make a right angle', centre: 'Tap the centre of the circle', bisect: 'Swing the arm to split the angle in half', square: 'Drag the top edge to make a square', balance: 'Tap where the triangle would balance' };
  const cv = $('eyCanvas'), ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1, active = false, last = 0;
  let mode = 'daily', tasks = [], ti = 0, results = [], state = 'menu', guess = null, judged = null, held = false, shownAt = 0;
  let data = store('smidge/eyeball') || { daily: {}, best: 0 };
  function makeRound(seed) { const r = rng(seed); return KINDS.map(k => E.make(k, r)); }
  function begin(m) { mode = m; tasks = makeRound(m === 'daily' ? dayNumber() * 3571 + 11 : Math.floor(Math.random() * 1e9)); ti = 0; results = []; startTask(); $('eyMenu').hidden = true; $('eyEnd').hidden = true; }
  function startTask() {
    const t = tasks[ti]; judged = null; held = false; state = 'aim';
    guess = t.handle ? t.handle.slice() : t.kind === 'square' ? [200, t.y0 - t.h] : null;
    $('eySub').textContent = `${mode === 'daily' ? 'Daily #' + dayNumber() : 'Practice'} · ${ti + 1} of ${KINDS.length}`;
    $('eyPrompt').textContent = PROMPT[t.kind];
    $('eyHint').innerHTML = ti === 0 ? 'Touch, adjust, and <b>let go to lock it in</b>' : 'Let go to lock it in';
  }
  const sq = p => p >= 90 ? '🟩' : p >= 70 ? '🟨' : p >= 40 ? '🟧' : '🟥';
  function lockIn() {
    const t = tasks[ti]; judged = E.judge(t, guess); const pts = E.points(judged);
    results.push({ err: judged.err, unit: judged.unit, pts }); state = 'shown'; shownAt = performance.now();
    const word = pts >= 95 ? 'Spot on!' : pts >= 85 ? 'Sharp eye' : pts >= 65 ? 'Not bad' : pts >= 40 ? 'Hmm, close-ish' : 'Way off';
    $('eyHint').innerHTML = `${word} · off by ${judged.err.toFixed(1)}${judged.unit.startsWith('%') ? judged.unit : '°'} · <b>${pts} pts</b> · tap to go on`;
    if (pts >= 85) [0, 4, 7].forEach((s, i) => Sound.tone(700 * Math.pow(2, s / 12), .22, 'triangle', .12, i * .06)); else Sound.tone(330, .18, 'triangle', .1);
    Sound.noise(.05, .3, 2800, 2); haptic(12);
  }
  function next() { if (ti + 1 < KINDS.length) { ti++; startTask(); } else finish(); }
  function finish() {
    state = 'end';
    const total = results.reduce((a, r) => a + r.pts, 0), max = KINDS.length * 100, stars = total >= 510 ? 3 : total >= 400 ? 2 : total >= 250 ? 1 : 0, day = dayNumber(), first = mode === 'daily' && data.daily[day] == null;
    if (mode === 'daily') data.daily[day] = Math.max(data.daily[day] || 0, total);
    data.best = Math.max(data.best || 0, total); store('smidge/eyeball', data);
    $('eyTotal').textContent = total;
    $('eyStars').innerHTML = [0, 1, 2].map(i => i < stars ? '★' : '<span class="off">★</span>').join('');
    const names = { mid: 'Middle', right: 'Right angle', centre: 'Centre', bisect: 'Half angle', square: 'Square', balance: 'Balance' };
    $('eyList').textContent = results.map((r, i) => `${sq(r.pts)} ${names[KINDS[i]]}: off by ${r.err.toFixed(1)}${r.unit === '°' ? '°' : '%'} · ${r.pts}`).join('\n');
    $('eyShare').textContent = `Smidge Eyeball ${mode === 'daily' ? '#' + day : '(practice)'} · ${total}/${max}\n${results.map(r => sq(r.pts)).join('')}`;
    $('eyNote').textContent = mode === 'daily' ? (first ? 'Today\'s score is saved. New tests tomorrow.' : 'Replays don\'t change today\'s score.') : `Best ever: ${data.best} of ${max}`;
    $('eyEnd').hidden = false;
  }
  function showMenu() {
    state = 'menu'; const day = dayNumber(), done = data.daily[day];
    $('eyDailyBtn').textContent = done != null ? `Daily #${day} again` : `Play daily #${day}`;
    $('eyMenuNote').textContent = done != null ? `Today: ${done} of 600. Best ever: ${data.best}.` : data.best ? `Best ever: ${data.best} of 600.` : 'Six tests of your eye. 100 points each for a perfect guess.';
    $('eyMenu').hidden = false; $('eyEnd').hidden = true; $('eySub').textContent = 'Judge by eye'; $('eyPrompt').textContent = ''; $('eyHint').textContent = '';
  }

  // ---------- drawing ----------
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let C = {};
  function readColors() { for (const k of ['paper', 'dot', 'pencil', 'pen']) C[k] = css('--ey-' + k); }
  function resize() { DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; }
  function view() { const top = 130, bot = 64, s = Math.min(W / 420, (H - top - bot) / 420); return { s, ox: W / 2 - 200 * s, oy: top + (H - top - bot) / 2 - 200 * s }; }
  const toWorld = e => { const v = view(), r = cv.getBoundingClientRect(); return [(e.clientX - r.left - v.ox) / v.s, (e.clientY - r.top - v.oy) / v.s]; };
  function line(a, b, col, w, dash) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]); }
  function dot(p, col, r) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fill(); }
  function handle(p) { ctx.fillStyle = '#fff'; ctx.strokeStyle = C.pen; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p[0], p[1], held ? 15 : 12, 0, 7); ctx.fill(); ctx.stroke(); }
  function draw() {
    const v = view();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.dot; const gap = 22 * v.s; for (let y = (v.oy % gap); y < H; y += gap) for (let x = (v.ox % gap); x < W; x += gap) ctx.fillRect(x - 1, y - 1, 2, 2);
    const t = tasks[ti]; if (!t || state === 'menu' || state === 'end' && !judged) return;
    ctx.setTransform(DPR * v.s, 0, 0, DPR * v.s, DPR * v.ox, DPR * v.oy); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const P = C.pencil, ink = 4;
    if (t.kind === 'mid') { line(t.a, t.b, P, ink); for (const e of [t.a, t.b]) dot(e, P, 6); if (guess) dot(guess, C.pen, 7); }
    if (t.kind === 'right') { const e = [t.v[0] + Math.cos(t.a) * 230, t.v[1] + Math.sin(t.a) * 230]; line(t.v, e, P, ink); line(t.v, guess, C.pen, ink); dot(t.v, P, 6); if (state === 'aim') handle(guess); }
    if (t.kind === 'centre') { ctx.strokeStyle = P; ctx.lineWidth = ink; ctx.beginPath(); ctx.arc(t.c[0], t.c[1], t.r, t.start, t.start + t.arc); ctx.stroke(); if (guess) dot(guess, C.pen, 7); }
    if (t.kind === 'bisect') { line(t.v, [t.v[0] + Math.cos(t.a1) * 260, t.v[1] + Math.sin(t.a1) * 260], P, ink); line(t.v, [t.v[0] + Math.cos(t.a2) * 260, t.v[1] + Math.sin(t.a2) * 260], P, ink); line(t.v, guess, C.pen, ink); dot(t.v, P, 6); if (state === 'aim') handle(guess); }
    if (t.kind === 'square') { const h = t.y0 - guess[1]; ctx.strokeStyle = P; ctx.lineWidth = ink; ctx.strokeRect(t.x0, t.y0 - h, t.w, h); line([t.x0, t.y0 - h], [t.x0 + t.w, t.y0 - h], C.pen, 6); if (state === 'aim') handle([200, t.y0 - h]); }
    if (t.kind === 'balance') { ctx.strokeStyle = P; ctx.lineWidth = ink; ctx.beginPath(); t.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.stroke(); if (guess) dot(guess, C.pen, 7); }
    if (judged) {
      const k = Math.min(1, (performance.now() - shownAt) / 300); ctx.globalAlpha = k;
      const good = '#1f9e5a';
      if (t.kind === 'right' || t.kind === 'bisect') line(t.v, judged.ans, good, 3, [8, 7]);
      else if (t.kind === 'square') { ctx.strokeStyle = good; ctx.lineWidth = 3; ctx.setLineDash([8, 7]); ctx.strokeRect(t.x0, t.y0 - t.w, t.w, t.w); ctx.setLineDash([]); }
      else { dot(judged.ans, good, 7); ctx.strokeStyle = good; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(judged.ans[0], judged.ans[1], 14, 0, 7); ctx.stroke(); line(judged.ans, guess, C.pen, 2, [3, 5]); }
      if (t.kind === 'centre') { ctx.strokeStyle = good; ctx.lineWidth = 2; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.arc(t.c[0], t.c[1], t.r, t.start + t.arc, t.start + Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
      ctx.globalAlpha = 1;
    }
  }
  function frame(now) { last = now; if (active) draw(); requestAnimationFrame(frame); }

  // ---------- input ----------
  function place(p) {
    const t = tasks[ti];
    if (t.kind === 'right') { const a = Math.atan2(p[1] - t.v[1], p[0] - t.v[0]); guess = [t.v[0] + Math.cos(a) * 170, t.v[1] + Math.sin(a) * 170]; }
    else if (t.kind === 'bisect') { const a = Math.atan2(p[1] - t.v[1], p[0] - t.v[0]); guess = [t.v[0] + Math.cos(a) * 200, t.v[1] + Math.sin(a) * 200]; }
    else if (t.kind === 'square') guess = [200, Math.max(-20, Math.min(t.y0 - 20, p[1]))];
    else guess = p;
  }
  cv.addEventListener('pointerdown', e => {
    if (!active) return; e.preventDefault(); Sound.audio();
    if (state === 'shown') { if (performance.now() - shownAt > 300) next(); return; }
    if (state !== 'aim') return;
    held = true; place(toWorld(e)); try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    Sound.tone(520, .03, 'triangle', .05);
  }, { passive: false });
  cv.addEventListener('pointermove', e => { if (held && state === 'aim') place(toWorld(e)); });
  cv.addEventListener('pointerup', () => { if (held && state === 'aim') { held = false; lockIn(); } });
  cv.addEventListener('pointercancel', () => { held = false; });
  $('eyDailyBtn').onclick = () => { Sound.audio(); begin('daily'); };
  $('eyPracticeBtn').onclick = () => { Sound.audio(); begin('practice'); };
  $('eyAgain').onclick = () => { Sound.audio(); begin(mode); };
  $('eyMenuBtn').onclick = () => { Sound.audio(); showMenu(); };
  $('eyCopy').onclick = e => { Sound.audio(); copyText($('eyShare').textContent, e.currentTarget); };
  addEventListener('resize', () => { if (active) resize(); });
  requestAnimationFrame(frame);
  return {
    enter() { active = true; resize(); readColors(); showMenu(); },
    leave() { active = false; held = false; },
    stats() { return { best: data.best || 0, today: data.daily[dayNumber()] }; },
  };
})();
