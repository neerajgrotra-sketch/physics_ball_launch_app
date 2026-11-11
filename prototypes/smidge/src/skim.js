// Skim: skip stones across a lake. Pull back and let go; the pull sets speed and angle. Five stones a round.
// A stone skips when it meets the water at a shallow angle (under CRIT degrees, wave slope included) and is still quick.
const SkimPhys = (() => {
  const G = 9.8, H0 = 1.25, DT = 1 / 240, CRIT = 20, MINV = 4.5;
  const surface = (x, t, w) => w.A * Math.sin(w.k * x - w.om * t + w.ph);
  const slope = (x, t, w) => w.A * w.k * Math.cos(w.k * x - w.om * t + w.ph);
  // Run one throw to the end. Returns the path (every 4th step), the skips and where it sank. Pure and deterministic.
  function simulate(angleDeg, speed, env, t0 = 0) {
    const a = angleDeg * Math.PI / 180;
    let x = 0, y = H0, vx = speed * Math.cos(a), vy = speed * Math.sin(a), t = t0, i = 0;
    const path = [[x, y, t]], skips = [];
    while (t - t0 < 30) {
      vy -= G * DT; vx += env.wind * 0.12 * DT; vx -= vx * 0.02 * DT;
      x += vx * DT; y += vy * DT; t += DT; i++;
      const s = surface(x, t, env.wave);
      if (y <= s && vy < 0) {
        const inc = Math.atan2(-vy, vx) * 180 / Math.PI + Math.atan(slope(x, t, env.wave)) * 180 / Math.PI;
        if (vx > MINV && inc < CRIT) {
          y = s; skips.push({ x, t, inc, v: Math.hypot(vx, vy) });
          vy = 0.5 * -vy + 0.04 * vx; vx *= 0.86 - Math.max(0, inc) * 0.012; // a steeper touch loses more speed
        } else { path.push([x, s, t]); return { path, skips, sankAt: x, end: t, inc }; }
      }
      if (i % 4 === 0) path.push([x, y, t]);
    }
    return { path, skips, sankAt: x, end: t, inc: 0 };
  }
  return { simulate, surface, H0, CRIT };
})();

const Skim = (() => {
  const $ = id => document.getElementById(id);
  const P = SkimPhys, N = 5;
  const cv = $('skCanvas'), ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1, active = false, last = 0, clock = 0;
  let mode = 'daily', envs = [], stone = 0, results = [], state = 'menu', pull = null, shot = null, ripples = [], drops = [], camX = -3;
  let data = store('smidge/skim') || { daily: {}, best: 0, far: 0 };

  function makeRound(seed) {
    const r = rng(seed);
    return Array.from({ length: N }, (_, i) => ({
      wind: (r() - .5) * (1 + i * 1.2),
      wave: { A: .015 + r() * (.02 + i * .009), k: 2 * Math.PI / (2.6 + r() * 2), om: 1.6 + r() * 1.2, ph: r() * 6 },
      rings: Array.from({ length: 2 }, () => 7 + r() * 26).sort((a, b) => a - b),
    }));
  }
  const env = () => envs[stone];
  function begin(m) {
    mode = m; envs = makeRound(m === 'daily' ? dayNumber() * 104729 + 7 : Math.floor(Math.random() * 1e9));
    stone = 0; results = []; ripples = []; drops = []; shot = null; state = 'aim'; camX = -3;
    $('skMenu').hidden = true; $('skEnd').hidden = true; setText();
  }
  function setText() {
    const e = env();
    $('skSub').textContent = `${mode === 'daily' ? 'Daily #' + dayNumber() : 'Practice'} · stone ${stone + 1} of ${N}`;
    const w = Math.abs(e.wind) < .3 ? 'Calm air' : `Wind ${Math.abs(e.wind).toFixed(1)} m/s ${e.wind > 0 ? 'behind you' : 'against you'}`;
    $('skPrompt').innerHTML = `${results.reduce((a, r) => a + r.score, 0)} points<small>${w} · ${e.wave.A > .045 ? 'choppy water' : e.wave.A > .03 ? 'small waves' : 'flat water'}</small>`;
    $('skHint').innerHTML = stone === 0 && !results.length ? 'Pull back and let go. <b>Flat and fast skips best.</b>' : 'Pull back and let go · skip through a ring for +2';
  }
  function aimFrom(dx, dy) {
    const len = Math.hypot(dx, dy), power = Math.min(1, len / 170);
    let ang = Math.atan2(dy, -dx) * 180 / Math.PI; // pull left and down to throw right and up
    if (dx > 0) ang = dy > 0 ? 40 : -20;
    ang = Math.max(-20, Math.min(40, ang));
    return { power, ang, speed: 6 + 22 * power };
  }
  function throwStone(aim) {
    const res = P.simulate(aim.ang, aim.speed, env(), clock);
    const e = env(), rings = e.rings.filter(rx => res.skips.some(s => Math.abs(s.x - rx) < .9));
    shot = { ...res, aim, rings, start: clock, shown: 0, score: res.skips.length + rings.length * 2 };
    state = 'fly';
    Sound.noise(.12, .3, 1800, .8); Sound.tone(300, .1, 'triangle', .06, 0, 500); haptic(10);
  }
  function stoneDone() {
    results.push({ skips: shot.skips.length, rings: shot.rings.length, far: shot.sankAt, score: shot.score });
    data.far = Math.max(data.far || 0, shot.sankAt);
    state = 'done';
    const s = shot.skips.length;
    $('skHint').innerHTML = `${s ? s + ' skip' + (s > 1 ? 's' : '') : 'Plop! No skips'}${shot.rings.length ? ` · <b>${shot.rings.length} ring${shot.rings.length > 1 ? 's' : ''}</b>` : ''} · ${shot.sankAt.toFixed(1)} m · tap to ${stone + 1 < N ? 'throw the next stone' : 'see your score'}`;
    if (!s) $('skHint').innerHTML += shot.inc > 0 ? `<br>${shot.aim.ang > 12 ? 'Too steep: throw flatter.' : shot.aim.power < .6 ? 'Too slow: pull back further.' : 'Too steep at the water: throw flatter.'}` : '';
  }
  function next() {
    if (stone + 1 < N) { stone++; shot = null; state = 'aim'; setText(); return; }
    finish();
  }
  function finish() {
    state = 'end';
    const total = results.reduce((a, r) => a + r.score, 0), day = dayNumber(), first = mode === 'daily' && data.daily[day] == null;
    if (mode === 'daily') data.daily[day] = Math.max(data.daily[day] || 0, total);
    data.best = Math.max(data.best || 0, total); store('smidge/skim', data);
    const stars = total >= 35 ? 3 : total >= 22 ? 2 : total >= 10 ? 1 : 0;
    $('skTotal').textContent = total;
    $('skStars').innerHTML = [0, 1, 2].map(i => i < stars ? '★' : '<span class="off">★</span>').join('');
    $('skList').textContent = results.map((r, i) => `Stone ${i + 1}: ${r.skips} skip${r.skips === 1 ? '' : 's'}${r.rings ? `, ${r.rings} ring${r.rings > 1 ? 's' : ''}` : ''} · ${r.far.toFixed(1)} m`).join('\n');
    $('skShare').textContent = `Smidge Skim ${mode === 'daily' ? '#' + day : '(practice)'} · ${total} points\n${results.map(r => '🪨'.concat(String(r.skips))).join(' ')}${results.some(r => r.rings) ? ' · ⭕×' + results.reduce((a, r) => a + r.rings, 0) : ''}`;
    $('skNote').textContent = mode === 'daily' ? (first ? 'Today\'s score is saved. New water tomorrow.' : 'Replays don\'t change today\'s score.') : `Best ever: ${data.best} points · longest throw ${data.far.toFixed(1)} m`;
    $('skEnd').hidden = false;
  }
  function showMenu() {
    state = 'menu'; const day = dayNumber(), done = data.daily[day];
    if (!envs.length) envs = makeRound(day * 104729 + 7);
    $('skDailyBtn').textContent = done != null ? `Daily #${day} again` : `Play daily #${day}`;
    $('skMenuNote').textContent = done != null ? `Today: ${done} points. Best ever: ${data.best}.` : data.best ? `Best ever: ${data.best} points.` : 'Five stones. A point for every skip, two more for skipping through a ring.';
    $('skMenu').hidden = false; $('skEnd').hidden = true;
    $('skSub').textContent = 'Skip stones'; $('skPrompt').innerHTML = ''; $('skHint').textContent = '';
  }

  // ---------- drawing ----------
  function resize() { DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; }
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let C = {};
  function readColors() { for (const k of ['sky1', 'sky2', 'water1', 'water2', 'hill', 'hill2', 'glint']) C[k] = css('--sk-' + k); }
  const px = () => Math.min(W / 12, H / 7);
  const waterY = () => H * .58;
  const sx = x => (x - camX) * px(), sy = y => waterY() - y * px();
  function draw(dt) {
    const k = px(), wy = waterY(), e = env();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    let g = ctx.createLinearGradient(0, 0, 0, wy); g.addColorStop(0, C.sky1); g.addColorStop(1, C.sky2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, wy + 1);
    // far hills with parallax
    for (const [col, par, hgt, seed] of [[C.hill2, .08, .9, 1], [C.hill, .2, .6, 2]]) {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, wy);
      for (let i = 0; i <= 40; i++) { const X = i / 40 * W, wx = X / k + camX * par; ctx.lineTo(X, wy - k * hgt * (1.2 + Math.sin(wx * .23 + seed) * .5 + Math.sin(wx * .61 + seed * 3) * .25)); }
      ctx.lineTo(W, wy); ctx.closePath(); ctx.fill();
    }
    g = ctx.createLinearGradient(0, wy, 0, H); g.addColorStop(0, C.water1); g.addColorStop(1, C.water2); ctx.fillStyle = g; ctx.fillRect(0, wy - 2, W, H - wy + 2);
    // wave line and glints
    ctx.strokeStyle = C.glint; ctx.lineWidth = 2; ctx.beginPath();
    for (let X = 0; X <= W; X += 6) { const x = camX + X / k, y = P.surface(x, clock, e.wave); X ? ctx.lineTo(X, sy(y)) : ctx.moveTo(X, sy(y)); }
    ctx.stroke();
    ctx.globalAlpha = .35; for (let i = 0; i < 30; i++) { const x = Math.floor(camX) + i * 1.3 + ((i * 7) % 5) * .2, X = sx(x), Y = wy + 10 + ((i * 37) % 9) * (H - wy) / 11; ctx.fillStyle = C.glint; ctx.fillRect(X, Y + Math.sin(clock * 2 + i) * 2, 10 + (i % 3) * 6, 2); } ctx.globalAlpha = 1;
    // distance buoys every 10 m
    ctx.textAlign = 'center'; ctx.font = `800 ${Math.max(11, k * .32)}px Nunito, sans-serif`;
    for (let m = 10; m < camX + W / k + 10; m += 10) { if (m < camX - 2) continue; const X = sx(m), Y = sy(P.surface(m, clock, e.wave)); ctx.fillStyle = '#ff5a4f'; ctx.beginPath(); ctx.ellipse(X, Y - k * .12, k * .16, k * .2, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#1c2233'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = C.glint; ctx.fillText(m + ' m', X, Y - k * .5); }
    // rings to skip through
    for (const rx of e.rings) {
      const hit = shot && shot.rings.includes(rx) && shot.skips.some(s => Math.abs(s.x - rx) < .9 && s.t <= clock);
      const X = sx(rx), Y = sy(P.surface(rx, clock, e.wave));
      ctx.lineWidth = Math.max(3, k * .09); ctx.strokeStyle = hit ? '#ffd23f' : '#ffffff'; ctx.globalAlpha = hit ? 1 : .85;
      ctx.beginPath(); ctx.ellipse(X, Y, k * .9, k * .18, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    }
    // ripples
    for (const rp of ripples) { const age = clock - rp.t; if (age < 0) continue; const f = Math.max(0, 1 - age / 2.2); ctx.strokeStyle = `rgba(255,255,255,${f * .8})`; ctx.lineWidth = 2; for (const m of [1, .6]) { ctx.beginPath(); ctx.ellipse(sx(rp.x), wy, k * (.2 + age * 1.1) * m, k * (.05 + age * .18) * m, 0, 0, 7); ctx.stroke(); } }
    ripples = ripples.filter(rp => clock - rp.t < 2.2);
    // pier
    ctx.fillStyle = '#7a4a24'; ctx.strokeStyle = '#1c2233'; ctx.lineWidth = 2;
    ctx.fillRect(sx(-6), sy(.62), (6.3) * k, k * .16); ctx.strokeRect(sx(-6), sy(.62), 6.3 * k, k * .16);
    for (const x of [-5.5, -3.5, -1.5, 0]) { ctx.fillRect(sx(x) - k * .07, sy(.62), k * .14, wy - sy(.62) + k * .5); }
    // drops
    for (const d of drops) { d.vy -= 9.8 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; ctx.fillStyle = `rgba(255,255,255,${Math.max(0, d.life)})`; ctx.beginPath(); ctx.arc(sx(d.x), sy(d.y), 3, 0, 7); ctx.fill(); }
    drops = drops.filter(d => d.life > 0 && d.y > -1);
    // the stone
    let st = null;
    if (state === 'aim' || state === 'menu') {
      const a = pull && pull.aim ? pull.aim : null, back = a ? a.power * .45 : 0, ar = a ? a.ang * Math.PI / 180 : 0;
      st = { x: -back * Math.cos(ar), y: P.H0 - back * Math.sin(ar), rot: 0 };
      if (a && a.power >= .1) {
        ctx.setLineDash([3, 7]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath();
        for (let i = 0; i <= 16; i++) { const tt = .35 * i / 16, x = a.speed * Math.cos(ar) * tt, y = P.H0 + a.speed * Math.sin(ar) * tt - 4.9 * tt * tt; i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y)); }
        ctx.stroke(); ctx.setLineDash([]);
      }
    } else if (shot) {
      const tt = clock, p = shot.path; let j = 0; while (j < p.length - 1 && p[j + 1][2] <= tt) j++;
      if (state === 'fly') {
        const a = p[j], b = p[Math.min(j + 1, p.length - 1)], f = b[2] > a[2] ? Math.min(1, (tt - a[2]) / (b[2] - a[2])) : 1;
        st = { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, rot: (tt - shot.start) * 25 };
        while (shot.shown < shot.skips.length && shot.skips[shot.shown].t <= tt) {
          const s = shot.skips[shot.shown]; shot.shown++;
          ripples.push({ x: s.x, t: s.t });
          for (let q = 0; q < 6; q++) drops.push({ x: s.x, y: 0, vx: (Math.random() - .3) * 2, vy: 1 + Math.random() * 2, life: .6 });
          const steps = [0, 2, 4, 7, 9], n = shot.shown - 1, semi = Math.floor(n / 5) * 12 + steps[n % 5];
          Sound.tone(520 * Math.pow(2, semi / 12), .16, 'sine', .22); Sound.noise(.05, .25, 3500, 1.5); haptic(5);
          if (shot.rings.some(rx => Math.abs(s.x - rx) < .9)) { Sound.tone(1046, .3, 'triangle', .12, .05); Sound.tone(1568, .3, 'triangle', .1, .12); }
        }
        if (tt >= shot.end) {
          state = 'sinking'; shot.sinkT = tt;
          ripples.push({ x: shot.sankAt, t: tt });
          for (let q = 0; q < 16; q++) drops.push({ x: shot.sankAt, y: 0, vx: (Math.random() - .5) * 2.4, vy: 1.5 + Math.random() * 3, life: .9 });
          Sound.noise(.35, .5, 700, .7, 'lowpass'); Sound.tone(180, .2, 'sine', .15, 0, 90); haptic(25);
        }
      }
      if (state === 'sinking') { const age = tt - shot.sinkT; st = { x: shot.sankAt, y: -age * .6, rot: 0, fade: Math.max(0, 1 - age * 1.5) }; if (age > 1) stoneDone(); }
    }
    if (st) {
      ctx.save(); ctx.translate(sx(st.x), sy(st.y)); ctx.globalAlpha = st.fade ?? 1;
      ctx.scale(1, .55 + .45 * Math.abs(Math.cos(st.rot))); ctx.fillStyle = '#8d939c'; ctx.strokeStyle = '#1c2233'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, k * .3, k * .19, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-k * .09, -k * .06, k * .1, k * .045, -.3, 0, 7); ctx.fill();
      ctx.restore();
    }
    // camera
    let target = -3;
    if ((state === 'fly' || state === 'sinking' || state === 'done') && st) target = Math.max(-3, st.x - W / k * .4);
    if (state === 'done' && shot) target = Math.max(-3, shot.sankAt - W / k * .5);
    camX += (target - camX) * (1 - Math.exp(-dt * (state === 'aim' ? 3 : 5)));
    // power bar while pulling
    if (pull && pull.aim && state === 'aim') {
      const a = pull.aim, w = Math.min(220, W * .5), x = (W - w) / 2, y = H - 64 - insetB();
      ctx.fillStyle = 'rgba(10,20,40,.45)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 4, y - 4, w + 8, 20, 10) : ctx.rect(x - 4, y - 4, w + 8, 20); ctx.fill();
      ctx.fillStyle = a.power > .6 ? '#5ee07a' : '#ffd23f'; ctx.fillRect(x, y, w * a.power, 12);
      ctx.fillStyle = '#fff'; ctx.font = '800 13px Nunito, sans-serif'; ctx.fillText(`${Math.round(a.power * 100)}% · ${a.ang.toFixed(0)}°`, W / 2, y - 12);
    }
  }
  const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom,0px)'; document.body.appendChild(probe);
  const insetB = () => parseFloat(getComputedStyle(probe).paddingBottom) || 0;
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (active) { clock += dt; draw(dt); }
    requestAnimationFrame(frame);
  }

  // ---------- input ----------
  cv.addEventListener('pointerdown', e => {
    if (!active) return; e.preventDefault(); Sound.audio();
    if (state === 'done') { next(); return; }
    if (state !== 'aim') return;
    pull = { x0: e.clientX, y0: e.clientY, aim: null, step: 0 };
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  }, { passive: false });
  cv.addEventListener('pointermove', e => {
    if (!pull) return;
    pull.aim = aimFrom(e.clientX - pull.x0, e.clientY - pull.y0);
    const st = Math.floor(pull.aim.power * 10); if (st > pull.step) { Sound.tone(200 + st * 40, .03, 'square', .02); } pull.step = st;
  });
  cv.addEventListener('pointerup', () => {
    if (!pull) return; const a = pull.aim; pull = null;
    if (state !== 'aim') return;
    if (!a || a.power < .1) { $('skHint').textContent = 'Pull back further, then let go.'; return; }
    throwStone(a);
  });
  cv.addEventListener('pointercancel', () => { pull = null; });
  $('skDailyBtn').onclick = () => { Sound.audio(); begin('daily'); };
  $('skPracticeBtn').onclick = () => { Sound.audio(); begin('practice'); };
  $('skAgain').onclick = () => { Sound.audio(); begin(mode); };
  $('skMenuBtn').onclick = () => { Sound.audio(); showMenu(); };
  $('skCopy').onclick = e => { Sound.audio(); copyText($('skShare').textContent, e.currentTarget); };
  addEventListener('resize', () => { if (active) resize(); });
  requestAnimationFrame(frame);
  return {
    enter() { active = true; resize(); readColors(); showMenu(); },
    leave() { active = false; pull = null; },
    stats() { return { best: data.best || 0, today: data.daily[dayNumber()] }; },
  };
})();
