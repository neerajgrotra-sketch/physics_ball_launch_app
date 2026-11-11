(() => {
// ---------- Levels ----------
// lag: 1 = the wave travels up exactly as fast as the arrow (one perfect moment lines up every balloon); other values make it partial.
const LEVELS = [
  { name: 'Breeze',    n: 12, amp: 34, base: .55, T: 2.6, lag: 1.0,  h2: 0,    types: {} },
  { name: 'Ripple',    n: 16, amp: 44, base: .45, T: 2.4, lag: 0.65, h2: 0,    types: {} },
  { name: 'Gold Rush', n: 20, amp: 46, base: .45, T: 2.3, lag: 1.3,  h2: .15,  types: { 6: 'g', 14: 'g' },                wind: { base: 4 } },
  { name: 'Fuse',      n: 22, amp: 52, base: .4,  T: 2.2, lag: 0.55, h2: .2,   types: { 4: 'b', 11: 'b', 17: 'b', 20: 'g' },  wind: { base: -7, gust: 2, T: 5 } },
  { name: 'Ironclad',  n: 24, amp: 50, base: .4,  T: 2.4, lag: 0.9,  h2: .2,   types: { 3: 'g', 8: 'a', 12: 'b', 16: 'a' },   wind: { base: 9, gust: 4, T: 4.5 } },
  { name: 'Gale',      n: 24, amp: 62, base: .35, T: 1.9, lag: 1.4,  h2: .35,  types: { 6: 'b', 12: 'a', 18: 'b', 21: 'g' },  wind: { base: -12, gust: 6, T: 3.8 } },
  { name: 'Crosswind', n: 24, amp: 48, base: .4,  T: 2.3, lag: 1.0,  h2: .2,   types: { 5: 'g', 10: 'b', 15: 'a', 19: 'b' },  wind: { base: 0, gust: 15, T: 6 } },
  { name: 'Storm',     n: 26, amp: 58, base: .35, T: 2.0, lag: 0.8,  h2: .3,   types: { 4: 'b', 9: 'a', 13: 'g', 17: 'a', 22: 'b' }, wind: { base: 13, gust: 9, T: 3.2 } },
];
// Wind (km/h, + blows right) pushes arrows sideways at WIND_ACC units/s² per km/h, so a slow arrow drifts much further.
// The tower leans downwind along the curve an arrow at LEAN_V would follow, so a well-judged pull can ride the lean.
const WIND_ACC = 4, LEAN_V = 1100;
// V0 is the speed each level's wave is designed around; the pull picks a speed between VMIN and VMAX.
const VMIN = 520, VMAX = 1300;
const DT = 1 / 240, V0 = 950, R = 21, S = 46, Y0 = 190, CX = 200, AL = 50, SPLIT_DEG = 8, SLOW = 0.985;
const HUES = ['#ff4b4b', '#ff8a2a', '#ffcd2e', '#9bd63a', '#3cc36b', '#22c3b5', '#36a8f0', '#4f6cf5', '#8a56f0', '#d24fd6', '#ff5fa2', '#ff7a6a'];

// ---------- State ----------
let L, li = 0, balloons = [], t = 0, state = 'menu', arrowsLeft = 3, shot = null, popped = 0, points = 0;
let pulling = false, pull = 0, pullStart = 0, pullStep = 0, pullId = null, keyPull = false, shortPull = false;
const PULL_W = 40; // how far back the string travels at full pull (world units)
let cloudPos = 0, streaks = [], windShown = null;
let particles = [], popups = [], cam = { y: 300, z: 1.4 }, slowmo = 0, shake = 0, recoil = 0, revealT = 0, collapsed = false;
const ghosts = {}; let muted = false, best = {};
best = storeObj('popshot/best', {});
let active = false;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = id => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, C = {}, FONT = '';

function readColors() {
  const cs = getComputedStyle(document.documentElement);
  FONT = cs.getPropertyValue('--display').trim();
  for (const k of ['sky-top', 'sky-bot', 'ground', 'ground-dark', 'ink', 'card', 'accent', 'gold', 'cloud', 'star']) C[k] = cs.getPropertyValue('--' + k).trim();
}
readColors();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors);
new MutationObserver(readColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); cv.style.width = W + 'px'; cv.style.height = H + 'px';
}
addEventListener('resize', resize); resize();

// ---------- Sway (pure function of time: same level, same moment, same tower) ----------
let om, kLag;
function bx(b, time) {
  const s = b.slot, a = L.amp * (L.base + (1 - L.base) * s / (L.n - 1));
  return CX + leanAt(Y0 + s * S, time) + a * (Math.sin(om * time - kLag * s) + L.h2 * Math.sin(2 * om * time - 2 * kLag * s + 0.9));
}
const by = b => Y0 + b.slot * S;
function windAt(time) { const w = L.wind; if (!w) return 0; return (w.base || 0) + (w.gust || 0) * Math.sin(2 * Math.PI * time / (w.T || 4) + 0.6); }
const windAcc = time => windAt(time) * WIND_ACC;
const leanAt = (y, time) => 0.5 * windAcc(time) * (y / LEAN_V) * (y / LEAN_V);
// The crossbow rocks on its stand about a pivot (degrees either side, seconds per rock). Its period is never the tower's,
// so the two drift in and out of step. The arrow leaves along the tilt the bow has at the moment you let go.
const BOWS = { Ripple: { amp: 1.5, T: 3.4 }, 'Gold Rush': { amp: 2, T: 3.1 }, Fuse: { amp: 2.5, T: 2.9 }, Ironclad: { amp: 3, T: 3.3, ph: 1.2 },
  Gale: { amp: 3.5, T: 2.6 }, Crosswind: { amp: 3, T: 3.7, ph: 2 }, Storm: { amp: 4, T: 2.7, ph: .5 } };
LEVELS.forEach(lv => { lv.bow = BOWS[lv.name] || null; });
const PIV_Y = -16;
function tiltAt(time) { const b = L.bow; return b ? b.amp * Math.PI / 180 * Math.sin(2 * Math.PI * time / b.T + (b.ph || 0)) : 0; }
// a point on the bow (drawn upright) moved to where the tilted bow has it; + tilt leans right
function onBow(x, y, th) { const dx = x - CX, dy = y - PIV_Y; return [CX + dx * Math.cos(th) + dy * Math.sin(th), PIV_Y - dx * Math.sin(th) + dy * Math.cos(th)]; }
const fullTop = () => Y0 + (L.n - 1) * S + R;

function startLevel(i) {
  li = (i + LEVELS.length) % LEVELS.length; L = LEVELS[li];
  om = 2 * Math.PI / L.T; kLag = L.lag * om * S / V0;
  balloons = Array.from({ length: L.n }, (_, j) => {
    const type = L.types[j] || 'n';
    return { slot: j, target: j, type, hp: type === 'a' ? 2 : 1, alive: true, col: HUES[j % HUES.length], wob: 0 };
  });
  cancelPull(); shortPull = false; streaks = []; windShown = null; t = 0; arrowsLeft = 3; popped = 0; points = 0; shot = null; particles = []; popups = []; collapsed = false;
  state = 'aim'; cam.z = zAim(); cam.y = camAim(cam.z);
  $('menu').hidden = true; $('result').hidden = true;
  updateHud();
}

// ---------- Camera ----------
const base = () => Math.min(W / 420, H / 720);
const zAim = () => 1.45;
const zFull = () => Math.min(1.3, (H * 0.72) / (base() * (fullTop() + 130)));
const camAim = z => 0.25 * H / (base() * z);
const camFull = z => (fullTop() - 30) / 2 + 0.07 * H / (base() * z);
function toScreen(x, y) { const k = base() * cam.z; return [W / 2 + (x - CX) * k, H / 2 - (y - cam.y) * k]; }

function updateCamera(dt) {
  let zt, yt;
  if (state === 'flight' && shot) {
    const lead = Math.max(0, ...shot.arrows.filter(a => a.alive).map(a => a.y), shot.lead || 0);
    shot.lead = lead;
    const p = Math.min(1, lead / fullTop());
    const e = p * p * (3 - 2 * p);
    zt = zAim() + (zFull() - zAim()) * e;
    const k = base() * cam.z;
    yt = Math.max(camAim(cam.z), Math.min(lead + 0.12 * H / k, camFull(cam.z)));
  } else if (state === 'reveal' || state === 'done') {
    zt = zFull(); yt = camFull(cam.z);
  } else { zt = zAim(); yt = camAim(cam.z); }
  const rz = state === 'flight' ? 3 : 4;
  cam.z += (zt - cam.z) * (1 - Math.exp(-dt * rz));
  cam.y += (yt - cam.y) * (1 - Math.exp(-dt * 7));
}

// ---------- Shooting ----------
const speedFor = p => VMIN + (VMAX - VMIN) * p;
function fire(power) {
  if (state !== 'aim' || arrowsLeft <= 0) return;
  arrowsLeft--;
  const y0 = AL - 2 - power * PULL_W;
  const th = tiltAt(t), [sx0, sy0] = onBow(CX, y0, th), v = speedFor(power);
  shot = { arrows: [mkArrow(sx0, sy0, v * Math.sin(th), v * Math.cos(th), true)], combo: 0, mult: 1, pops: 0, splitUsed: false, phase: (t % L.T) / L.T, power, end: 0, lead: 0 };
  state = 'flight'; recoil = .4 + power * .8; sfx.launch(power); buzz(8 + Math.round(power * 16));
  updateHud();
}
function mkArrow(x, y, vx, vy, main) { return { x, y, vx, vy, alive: true, main, trail: [], falling: false, rot: 0, spin: 0 }; }
function split() {
  if (state !== 'flight' || !shot || shot.splitUsed) return;
  const m = shot.arrows.find(a => a.main && a.alive); if (!m) return;
  shot.splitUsed = true;
  const sp = Math.hypot(m.vx, m.vy), r = SPLIT_DEG * Math.PI / 180;
  shot.arrows.push(mkArrow(m.x, m.y, -sp * Math.sin(r), sp * Math.cos(r), false), mkArrow(m.x, m.y, sp * Math.sin(r), sp * Math.cos(r), false));
  for (let i = 0; i < 10; i++) particles.push({ kind: 'spark', x: m.x, y: m.y - 10, vx: (Math.random() - .5) * 260, vy: -Math.random() * 120, life: .35, max: .35, col: C.gold, size: 3 });
  sfx.split(); buzz(8); updateHud();
}
function stopArrow(a) { a.alive = false; a.falling = true; a.vx = (Math.random() - .5) * 120; a.vy = 120; a.spin = (Math.random() < .5 ? -1 : 1) * 9; }

function pop(b, by_bomb) {
  if (!b.alive) return false;
  if (b.type === 'a' && b.hp > 1) { b.hp--; b.wob = 1; crackFx(b); sfx.clank(); buzz(25); return false; }
  b.alive = false; popped++; shot.pops++; shot.combo++;
  const gain = shot.combo * shot.mult; points += gain;
  const x = bx(b, t), y = by(b);
  burst(x, y, b.type === 'g' ? C.gold : b.type === 'b' ? '#ffb02e' : b.type === 'a' ? '#c7cfd8' : b.col, b.type === 'b' ? 34 : 22);
  popups.push({ x: x + 30, y, text: '+' + gain, life: .9, max: .9, col: b.type === 'g' ? C.gold : '#fff', size: 18 + Math.min(14, shot.combo) });
  sfx.pop(shot.combo); buzz(6);
  if (b.type === 'g') { shot.mult *= 2; popups.push({ x: x - 34, y: y + 14, text: '×2!', life: 1.1, max: 1.1, col: C.gold, size: 30 }); sfx.chime(); }
  if (b.type === 'b') {
    shake = 1; sfx.boom(); buzz(40);
    particles.push({ kind: 'ring', x, y, life: .45, max: .45, size: S * 1.6 });
    const s0 = b.slot;
    for (const nb of balloons) if (nb.alive && Math.abs(nb.slot - s0) < 1.6) pop(nb, true);
  }
  if (shot.combo >= 3) showCombo();
  if (shot.combo % 8 === 0) slowmo = Math.max(slowmo, .35);
  if (popped === L.n) { slowmo = .9; popups.push({ x: CX, y: y + 50, text: 'CLEAN SWEEP', life: 1.6, max: 1.6, col: C.gold, size: 34, center: true }); }
  updateHud();
  return true;
}

// ---------- Fixed-step simulation ----------
function step() {
  t += DT;
  cloudPos += (6 + windAt(t) * 3) * DT;
  for (const b of balloons) { b.slot += (b.target - b.slot) * Math.min(1, DT * 8); b.wob = Math.max(0, b.wob - DT * 3); }
  if (state === 'flight' && shot) {
    for (const a of shot.arrows) {
      if (!a.alive) continue;
      const py = a.y;
      a.vx += windAcc(t) * DT;
      a.x += a.vx * DT; a.y += a.vy * DT;
      for (const b of balloons) {
        if (!b.alive) continue;
        const bxv = bx(b, t), byv = by(b), dx = a.x - bxv, dy = a.y - byv;
        if (dx * dx + dy * dy < (R + 2) * (R + 2)) {
          if (b.type === 'a' && b.hp > 1) { pop(b); stopArrow(a); break; }
          pop(b); a.vx *= SLOW; a.vy *= SLOW;
        } else if (py < byv && a.y >= byv && Math.abs(dx) < R + 12 && Math.abs(dx) >= R + 2) {
          popups.push({ x: bxv + (dx > 0 ? -38 : 38), y: byv, text: 'close!', life: .6, max: .6, col: '#fff', size: 14 });
        }
      }
      if (a.alive && (a.y > fullTop() + 420 || a.x < -60 || a.x > 460)) a.alive = false;
    }
    for (const a of shot.arrows) if (a.falling) { a.vy -= 1400 * DT; a.x += a.vx * DT; a.y += a.vy * DT; a.rot += a.spin * DT; if (a.y < -200) a.falling = false; }
    if (!shot.arrows.some(a => a.alive)) { shot.end += DT; if (shot.end > .45) endShot(); }
  } else if (state === 'reveal') {
    revealT += DT;
    if (!collapsed && revealT > .35) {
      collapsed = true; let j = 0;
      for (const b of balloons.slice().sort((p, q) => p.slot - q.slot)) if (b.alive) b.target = j++;
      if (j < L.n && j > 0) sfx.settle();
    }
    if (revealT > 1.6) {
      if (popped === L.n || arrowsLeft === 0) finish();
      else { state = 'aim'; shot = null; updateHud(); }
    }
  }
}
function endShot() {
  (ghosts[li] = ghosts[li] || []).push({ phase: shot.phase, power: shot.power, pops: shot.pops });
  if (ghosts[li].length > 6) ghosts[li].shift();
  state = 'reveal'; revealT = 0; collapsed = false; hideCombo(); updateHud();
}
function finish() {
  state = 'done';
  const bonus = popped === L.n ? arrowsLeft * 25 : 0; points += bonus;
  const f = popped / L.n, stars = f >= 1 ? 3 : f >= .75 ? 2 : f >= .4 ? 1 : 0;
  const prev = best[L.name] || { pts: 0, stars: 0 };
  const isBest = points > prev.pts;
  best[L.name] = { pts: Math.max(prev.pts, points), stars: Math.max(prev.stars, stars) };
  store('popshot/best', best);
  $('rTitle').textContent = stars === 3 ? (arrowsLeft > 0 ? 'Clean sweep, arrows to spare!' : 'Clean sweep!') : stars === 2 ? 'So close to all of them' : stars === 1 ? 'Getting the rhythm' : 'Watch the wave';
  $('rStars').innerHTML = [0, 1, 2].map(i => i < stars ? '★' : '<span class="off">★</span>').join('');
  $('rPop').textContent = popped + '/' + L.n;
  $('rPts').textContent = points;
  $('rBest').textContent = best[L.name].pts;
  $('rNote').textContent = (bonus ? `+${bonus} for ${arrowsLeft} unused arrow${arrowsLeft > 1 ? 's' : ''}. ` : '') +
    (isBest ? 'New best. ' : '') +
    (stars < 3 ? 'The dial shows when you fired each arrow, the marks on the power bar how hard you pulled, both coloured by how many it popped. The tower sways the same way every try.' : 'Points grow with every pop in a row, so one long arrow beats three short ones.');
  setTimeout(() => { if (state === 'done') { $('result').hidden = false; sfx.fanfare(stars); } }, 500);
  updateHud();
}

// ---------- Effects ----------
function burst(x, y, col, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 320;
    particles.push({ kind: 'conf', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 120, life: 1 + Math.random() * .6, max: 1.6, col: i % 3 ? col : '#fff', size: 3 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - .5) * 18 });
  }
  for (let i = 0; i < 5; i++) {
    const a = Math.random() * Math.PI * 2;
    particles.push({ kind: 'shred', x, y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160 + 60, life: .7, max: .7, col, size: 8 + Math.random() * 6, rot: a, vr: (Math.random() - .5) * 12 });
  }
  particles.push({ kind: 'ring', x, y, life: .25, max: .25, size: R * 1.8, col: '#fff' });
}
function crackFx(b) {
  const x = bx(b, t), y = by(b);
  for (let i = 0; i < 12; i++) particles.push({ kind: 'spark', x, y: y - R, vx: (Math.random() - .5) * 300, vy: -Math.random() * 200 - 40, life: .4, max: .4, col: '#ffe9a8', size: 2.5 });
  popups.push({ x: x + 34, y, text: 'CLANK', life: .8, max: .8, col: '#dfe5ec', size: 18 });
}
function updateFx(dt) {
  for (const p of particles) {
    p.life -= dt;
    if (p.kind === 'conf' || p.kind === 'shred' || p.kind === 'spark') {
      p.vy -= (p.kind === 'shred' ? 600 : 520) * dt; p.vx *= Math.exp(-dt * 1.8); p.vy *= Math.exp(-dt * 1.2);
      p.x += p.vx * dt; p.y += p.vy * dt; if (p.vr) p.rot += p.vr * dt;
    }
  }
  particles = particles.filter(p => p.life > 0);
  for (const p of popups) { p.life -= dt; p.y += 40 * dt; }
  popups = popups.filter(p => p.life > 0);
  shake = Math.max(0, shake - dt * 3); recoil = Math.max(0, recoil - dt * 4);
}

// ---------- Drawing ----------
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
function drawBalloon(b) {
  const x = bx(b, t), y = by(b), wob = b.wob ? Math.sin(b.wob * 30) * b.wob * 4 : 0;
  const col = b.type === 'g' ? '#ffd23f' : b.type === 'b' ? '#2c2c36' : b.type === 'a' ? '#a3adb8' : b.col;
  ctx.save(); ctx.translate(x + wob, y);
  const lw = 2.2 / (base() * cam.z);
  // knot
  ctx.fillStyle = shade(col, -.35); ctx.beginPath(); ctx.moveTo(0, -R * 1.06); ctx.lineTo(-5, -R * 1.06 - 7); ctx.lineTo(5, -R * 1.06 - 7); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = lw; ctx.stroke();
  // body
  const g = ctx.createRadialGradient(-R * .35, R * .45, R * .1, 0, 0, R * 1.2);
  g.addColorStop(0, shade(col, .45)); g.addColorStop(.55, col); g.addColorStop(1, shade(col, -.3));
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, R, R * 1.08, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (b.type === 'a') {
    ctx.strokeStyle = shade(col, -.35); ctx.lineWidth = 4;
    for (const yy of [-7, 7]) { ctx.beginPath(); ctx.moveTo(-R * .95, yy); ctx.quadraticCurveTo(0, yy - 4, R * .95, yy); ctx.stroke(); }
    ctx.fillStyle = shade(col, -.45);
    for (const xx of [-12, 0, 12]) for (const yy of [-7, 7]) { ctx.beginPath(); ctx.arc(xx, yy - 2, 1.8, 0, 7); ctx.fill(); }
    if (b.hp === 1) { ctx.strokeStyle = C.ink; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(-4, 20); ctx.lineTo(3, 9); ctx.lineTo(-3, 2); ctx.lineTo(6, -8); ctx.lineTo(1, -16); ctx.stroke(); }
  } else if (b.type === 'b') {
    ctx.fillStyle = '#ffb02e'; ctx.beginPath();
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? 4.5 : 10; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, 7); ctx.fill();
  } else if (b.type === 'g') {
    const tw = (Math.sin(t * 5 + b.slot) + 1) / 2;
    ctx.fillStyle = `rgba(255,255,255,${.5 + tw * .5})`;
    star4(R * .45, -R * .2, 3 + tw * 4); star4(-R * .2, -R * .5, 2 + (1 - tw) * 3);
  }
  // shine
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(-R * .42, R * .45, R * .2, R * .12, .8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function star4(x, y, r) { ctx.beginPath(); ctx.moveTo(x, y + r); ctx.lineTo(x + r * .25, y + r * .25); ctx.lineTo(x + r, y); ctx.lineTo(x + r * .25, y - r * .25); ctx.lineTo(x, y - r); ctx.lineTo(x - r * .25, y - r * .25); ctx.lineTo(x - r, y); ctx.lineTo(x - r * .25, y + r * .25); ctx.closePath(); ctx.fill(); }

function drawArrow(a) {
  const ang = Math.atan2(a.vy, a.vx) + (a.falling ? a.rot : 0);
  ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(ang - Math.PI / 2);
  const lw = 2 / (base() * cam.z);
  ctx.strokeStyle = C.ink; ctx.lineWidth = lw;
  ctx.fillStyle = '#8b5a2b'; ctx.fillRect(-2, -AL, 4, AL - 8); ctx.strokeRect(-2, -AL, 4, AL - 8);
  ctx.fillStyle = '#d9dee5'; ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(-6, -10); ctx.lineTo(6, -10); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.accent;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, -AL + 14); ctx.lineTo(s * 7, -AL + 4); ctx.lineTo(s * 7, -AL - 4); ctx.lineTo(0, -AL + 4); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}
function drawCrossbow() {
  const k = base() * cam.z, th = tiltAt(t);
  // stand: two legs from the pivot to the ground, drawn upright behind the rocking bow
  ctx.strokeStyle = C.ink; ctx.lineWidth = 3 / k; ctx.fillStyle = '#5b6573';
  ctx.beginPath(); ctx.moveTo(CX - 4, PIV_Y + 4); ctx.lineTo(CX - 44, -70); ctx.lineTo(CX - 32, -70); ctx.lineTo(CX, PIV_Y - 14); ctx.lineTo(CX + 32, -70); ctx.lineTo(CX + 44, -70); ctx.lineTo(CX + 4, PIV_Y + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.translate(CX, PIV_Y); ctx.rotate(-th); ctx.translate(-CX, -PIV_Y);
  drawBowUpright();
  ctx.restore();
  ctx.fillStyle = '#d9dee5'; ctx.beginPath(); ctx.arc(CX, PIV_Y, 5, 0, 7); ctx.fill(); ctx.stroke();
}
function drawBowUpright() {
  const loaded = state === 'aim' && arrowsLeft > 0;
  ctx.save(); ctx.translate(CX, -recoil * 10);
  const lw = 2.4 / (base() * cam.z);
  ctx.strokeStyle = C.ink; ctx.lineWidth = lw; ctx.lineJoin = 'round';
  // stock
  ctx.fillStyle = '#9a6234'; roundRect(-9, -64, 18, 92, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7a4a24'; roundRect(-14, -78, 28, 22, 8); ctx.fill(); ctx.stroke();
  // string
  const p = loaded ? pull : 0, tipX = 50 - p * 8, tipY = 12 - p * 16;
  const sy = loaded ? -2 - p * PULL_W : 12;
  ctx.strokeStyle = shade(C.ink.startsWith('#') ? C.ink : '#1c2233', .4); ctx.lineWidth = (1.6 + p) / (base() * cam.z);
  ctx.beginPath(); ctx.moveTo(-tipX, tipY); ctx.lineTo(0, sy); ctx.lineTo(tipX, tipY); ctx.stroke();
  // limbs bend further as the string comes back
  ctx.strokeStyle = C.ink; ctx.lineWidth = 9 / (base() * cam.z) + 4;
  ctx.beginPath(); ctx.moveTo(-tipX - 2, tipY); ctx.quadraticCurveTo(0, 46, tipX + 2, tipY); ctx.stroke();
  ctx.strokeStyle = '#5b6573'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(-tipX, tipY + 1); ctx.quadraticCurveTo(0, 44, tipX, tipY + 1); ctx.stroke();
  ctx.restore();
  if (loaded) {
    const jit = p > .85 && !reduceMotion ? Math.sin(performance.now() / 18) * (p - .85) * 8 : 0;
    drawArrow({ x: CX + jit, y: AL - 2 - p * PULL_W, vx: 0, vy: 1, falling: false });
  }
}
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

const CLOUDS = [[60, 260, 1], [330, 520, .8], [90, 820, 1.2], [300, 1100, .9], [140, 1380, 1.1], [320, 1650, .8]];
const STARS = Array.from({ length: 60 }, (_, i) => [(i * 97) % 420 - 10, 120 + ((i * 211) % 1700), 1 + (i % 3) * .6]);

function render() {
  const k = base() * cam.z;
  // sky (screen space)
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, C['sky-top']); sky.addColorStop(1, C['sky-bot']);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  const sh = shake && !reduceMotion ? (Math.random() - .5) * 10 * shake : 0;
  ctx.setTransform(DPR * k, 0, 0, -DPR * k, DPR * (W / 2 - CX * k + sh), DPR * (H / 2 + cam.y * k + sh));
  // stars + clouds with mild parallax
  ctx.save(); ctx.translate(0, cam.y * .35);
  ctx.fillStyle = C.star; for (const [x, y, r] of STARS) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
  ctx.fillStyle = C.cloud;
  for (const [x, y, s] of CLOUDS) { const cx = (((x + cloudPos * s) % 520) + 520) % 520 - 60; for (const [dx, dy, r] of [[0, 0, 26], [24, 8, 22], [-24, 4, 20], [46, -2, 16], [-44, -4, 14]]) { ctx.beginPath(); ctx.arc(cx + dx * s, y + dy * s, r * s, 0, 7); ctx.fill(); } }
  ctx.restore();
  // ground
  ctx.fillStyle = C['ground-dark']; ctx.beginPath(); ctx.moveTo(-400, -40); ctx.quadraticCurveTo(CX, -6, 800, -40); ctx.lineTo(800, -2000); ctx.lineTo(-400, -2000); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.ground; ctx.beginPath(); ctx.moveTo(-400, -52); ctx.quadraticCurveTo(CX, -22, 800, -52); ctx.lineTo(800, -2000); ctx.lineTo(-400, -2000); ctx.closePath(); ctx.fill();
  // flight line
  if (state === 'aim' || state === 'menu') {
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2 / k; ctx.setLineDash([6 / k, 8 / k]);
    const th = tiltAt(t), [ax, ay] = onBow(CX, AL + 10, th), [bx2, by2] = onBow(CX, fullTop() + 200, th);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx2, by2); ctx.stroke(); ctx.setLineDash([]);
  }
  // while pulling: the first 0.3 s of flight at this power, wind included (never the rest)
  if (state === 'aim' && pulling && pull >= .1) {
    const v = speedFor(pull), a0 = windAcc(t), th = tiltAt(t), [x0, y0] = onBow(CX, AL - 2 - pull * PULL_W, th);
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 3 / k; ctx.setLineDash([2 / k, 7 / k]); ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) { const tau = .3 * i / 20; const px = x0 + v * Math.sin(th) * tau + .5 * a0 * tau * tau, py = y0 + v * Math.cos(th) * tau; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  // tether from the lowest balloon
  const alive = balloons.filter(b => b.alive).sort((p, q) => p.slot - q.slot);
  if (alive.length) {
    const b0 = alive[0], x0 = bx(b0, t), y0 = by(b0) - R * 1.06 - 7;
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5 / k;
    ctx.beginPath(); ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(x0, y0 - 30, x0 + (CX + 70 - x0) * .4, 60, CX + 70, 6); ctx.stroke();
    ctx.fillStyle = '#7a4a24'; ctx.fillRect(CX + 66, -14, 8, 22);
  }
  drawFlag(k);
  // ties between neighbours
  ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5 / k;
  for (let i = 1; i < alive.length; i++) {
    const p = alive[i - 1], q = alive[i];
    if (q.slot - p.slot < 1.3) { ctx.beginPath(); ctx.moveTo(bx(p, t), by(p) + R); ctx.lineTo(bx(q, t), by(q) - R - 6); ctx.stroke(); }
  }
  for (const b of alive) drawBalloon(b);
  drawCrossbow();
  // arrows and trails
  if (shot) for (const a of shot.arrows) {
    if (a.alive) { a.trail.push([a.x, a.y]); if (a.trail.length > 18) a.trail.shift(); }
    else if (a.trail.length) a.trail.shift();
    if (a.trail.length > 1) {
      ctx.lineCap = 'round';
      for (let i = 1; i < a.trail.length; i++) {
        ctx.strokeStyle = `rgba(255,255,255,${i / a.trail.length * .6})`; ctx.lineWidth = (i / a.trail.length) * 5 / k + 1 / k;
        ctx.beginPath(); ctx.moveTo(a.trail[i - 1][0], a.trail[i - 1][1] - AL); ctx.lineTo(a.trail[i][0], a.trail[i][1] - AL); ctx.stroke();
      }
    }
    if (a.alive || a.falling) drawArrow(a);
  }
  // particles
  for (const p of particles) {
    const f = Math.max(0, p.life / p.max);
    if (p.kind === 'ring') {
      ctx.strokeStyle = `rgba(255,255,255,${f * .9})`; ctx.lineWidth = 3 * f / k + .5 / k;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - f), 0, 7); ctx.stroke();
    } else if (p.kind === 'spark') {
      ctx.globalAlpha = f; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    } else {
      ctx.save(); ctx.globalAlpha = Math.min(1, f * 1.6); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col;
      if (p.kind === 'shred') { ctx.beginPath(); ctx.moveTo(-p.size, 0); ctx.quadraticCurveTo(0, p.size * .8, p.size, 0); ctx.quadraticCurveTo(0, p.size * .3, -p.size, 0); ctx.fill(); }
      else ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
  }
  // screen-space: popups, dial, minimap
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  for (const p of popups) {
    const [sx, sy] = toScreen(p.center ? CX : p.x, p.y), f = Math.min(1, p.life / p.max * 2);
    ctx.globalAlpha = f; ctx.font = `${p.size}px ${FONT}`;
    ctx.lineWidth = 4; ctx.strokeStyle = '#1c2233'; ctx.strokeText(p.text, sx, sy); ctx.fillStyle = p.col; ctx.fillText(p.text, sx, sy);
  }
  ctx.globalAlpha = 1;
  const scrimH = 150 + insetT(), scrim = ctx.createLinearGradient(0, 0, 0, scrimH);
  scrim.addColorStop(0, C['sky-top']); scrim.addColorStop(.55, C['sky-top']); scrim.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = .82; ctx.fillStyle = scrim; ctx.fillRect(0, 0, W, scrimH); ctx.globalAlpha = 1;
  drawStreaks(lastRealDt);
  if (state !== 'menu') drawDial();
  if (state === 'aim' && arrowsLeft > 0) drawPowerBar();
  if ((state === 'aim' || state === 'flight') && cam.z > zFull() * 1.35) drawMinimap();
}

function drawDial() {
  const r = 26, cx = Math.max(16, insetL()) + r + 6, cy = H - 64 - insetB() - r;
  ctx.save();
  ctx.fillStyle = 'rgba(20,24,40,.45)'; ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
  const gs = ghosts[li] || [];
  gs.forEach((g, i) => {
    const a = g.phase * Math.PI * 2 - Math.PI / 2, f = g.pops / L.n;
    ctx.strokeStyle = f > .6 ? '#5ee07a' : f > .3 ? '#ffd23f' : '#ff7b7b'; ctx.globalAlpha = .45 + .55 * (i + 1) / gs.length; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (r - 7), cy + Math.sin(a) * (r - 7)); ctx.lineTo(cx + Math.cos(a) * (r + 5), cy + Math.sin(a) * (r + 5)); ctx.stroke();
    if (i === gs.length - 1) { ctx.fillStyle = '#fff'; ctx.font = '800 10px Nunito, sans-serif'; ctx.fillText(g.pops, cx + Math.cos(a) * (r + 14), cy + Math.sin(a) * (r + 14)); }
  });
  ctx.globalAlpha = 1;
  const a = (t % L.T) / L.T * Math.PI * 2 - Math.PI / 2;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4)); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 7); ctx.fill();
  ctx.font = '800 9px Nunito, sans-serif'; ctx.fillText('RHYTHM', cx, cy + r + 15);
  ctx.restore();
}
function drawFlag(k) {
  // a pennant on the tether peg: points downwind, longer and livelier in stronger wind, hangs limp in calm
  const w = windAt(t), mag = Math.min(1, Math.abs(w) / 20), dir = w >= 0 ? 1 : -1, px = CX + 70, top = 52;
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5 / k;
  ctx.beginPath(); ctx.moveTo(px, -14); ctx.lineTo(px, top); ctx.stroke();
  const len = 14 + mag * 30, droop = (1 - mag) * 14, fl = Math.sin(t * (6 + mag * 14)) * (2 + mag * 3);
  ctx.fillStyle = C.accent; ctx.beginPath(); ctx.moveTo(px, top);
  ctx.quadraticCurveTo(px + dir * len * .5, top - 2 + fl, px + dir * len, top - 7 - droop + fl * .6);
  ctx.quadraticCurveTo(px + dir * len * .5, top - 12 - droop * .4 - fl, px, top - 15);
  ctx.closePath(); ctx.fill(); ctx.stroke();
}
function drawStreaks(dt) {
  const w = windAt(t), mag = Math.abs(w);
  if (mag > 1 && state !== 'menu' && !reduceMotion && Math.random() < mag * dt * 1.4) streaks.push({ x: w > 0 ? -60 : W + 60, y: 120 + Math.random() * (H - 260), len: 30 + mag * 4 + Math.random() * 30, life: 0 });
  ctx.lineCap = 'round';
  for (const st of streaks) {
    st.x += windAt(t) * 34 * dt; st.life += dt;
    const a = Math.min(.5, st.life * 2) * Math.min(1, mag / 6);
    ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(st.x, st.y); ctx.quadraticCurveTo(st.x - Math.sign(w) * st.len * .5, st.y - 4, st.x - Math.sign(w) * st.len, st.y); ctx.stroke();
  }
  streaks = streaks.filter(st => st.x > -200 && st.x < W + 200 && st.life < 8);
}
function drawPowerBar() {
  const w = Math.min(220, W * .5), h = 12, x = (W - w) / 2, y = H - 54 - insetB();
  ctx.save();
  ctx.globalAlpha = pulling ? 1 : .55;
  ctx.fillStyle = 'rgba(20,24,40,.45)'; roundRectS(x - 4, y - 4, w + 8, h + 8, 10); ctx.fill();
  if (pull > 0) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#5ee07a'); g.addColorStop(.6, '#ffd23f'); g.addColorStop(1, C.accent);
    ctx.fillStyle = g; roundRectS(x, y, Math.max(h, w * pull), h, 6); ctx.fill();
  }
  // where earlier arrows were pulled to, coloured by how many they popped
  (ghosts[li] || []).forEach((gh, i, arr) => {
    const f = gh.pops / L.n, gx = x + w * gh.power;
    ctx.globalAlpha = (pulling ? 1 : .7) * (.45 + .55 * (i + 1) / arr.length);
    ctx.fillStyle = f > .6 ? '#5ee07a' : f > .3 ? '#ffd23f' : '#ff7b7b';
    ctx.beginPath(); ctx.moveTo(gx, y - 3); ctx.lineTo(gx - 5, y - 10); ctx.lineTo(gx + 5, y - 10); ctx.closePath(); ctx.fill();
  });
  ctx.restore();
}
function drawMinimap() {
  const top = 132 + insetT(), bot = H - 120 - insetB(), h = bot - top, x0 = W - Math.max(16, insetR()) - 14;
  const sc = h / (fullTop() + 60);
  ctx.save();
  ctx.fillStyle = 'rgba(20,24,40,.35)'; roundRectS(x0 - 14, top - 8, 28, h + 16, 12); ctx.fill();
  for (const b of balloons) if (b.alive) {
    ctx.fillStyle = b.type === 'g' ? '#ffd23f' : b.type === 'b' ? '#2c2c36' : b.type === 'a' ? '#a3adb8' : b.col;
    ctx.beginPath(); ctx.arc(x0 + (bx(b, t) - CX) * .18, bot - (by(b) + 30) * sc, Math.max(2.2, R * sc), 0, 7); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, bot); ctx.lineTo(x0, top); ctx.stroke();
  if (shot) for (const a of shot.arrows) if (a.alive) { ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(x0 + (a.x - CX) * .18, bot - (a.y + 30) * sc, 3, 0, 7); ctx.fill(); }
  const k = base() * cam.z, vt = cam.y + H / 2 / k, vb = cam.y - H / 2 / k;
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5;
  const yA = Math.max(top - 6, bot - (vt + 30) * sc), yB = Math.min(bot + 6, bot - (vb + 30) * sc);
  roundRectS(x0 - 11, yA, 22, Math.max(6, yB - yA), 6); ctx.stroke();
  ctx.restore();
}
function roundRectS(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
const probe = document.createElement('div');
probe.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
document.body.appendChild(probe);
const inset = s => parseFloat(getComputedStyle(probe)['padding' + s]) || 0;
const insetT = () => inset('Top'), insetB = () => inset('Bottom'), insetL = () => inset('Left'), insetR = () => inset('Right');

// ---------- HUD ----------
const ARROW_SVG = '<svg viewBox="0 0 16 30" aria-hidden="true"><path d="M8 1 L13 9 H3 Z" fill="#d9dee5" stroke="#1c2233" stroke-width="1.5" stroke-linejoin="round"/><rect x="6.5" y="9" width="3" height="15" fill="#9a6234" stroke="#1c2233" stroke-width="1.2"/><path d="M8 22 L3 29 V24 Z M8 22 L13 29 V24 Z" fill="#ff4f5e" stroke="#1c2233" stroke-width="1.2" stroke-linejoin="round"/></svg>';
function updateWindChip() {
  const el = $('wind'); if (!L) return;
  if (!L.wind) { if (!el.hidden) el.hidden = true; windShown = null; return; }
  const w = windAt(t), v = Math.round(Math.abs(w)), key = v + (w >= 0 ? 'r' : 'l');
  if (key === windShown && !el.hidden) return;
  windShown = key; el.hidden = false;
  el.innerHTML = `<svg viewBox="0 0 18 12" aria-hidden="true" style="transform:scaleX(${w >= 0 ? 1 : -1})"><path d="M1 6 H14 M10 2 L15 6 L10 10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>${v} km/h`;
  el.setAttribute('aria-label', `Wind ${v} kilometres per hour, blowing ${w >= 0 ? 'right' : 'left'}`);
}
function updateHud() {
  if (!L) return;
  $('lvlname').textContent = `Level ${li + 1} · ${L.name}`;
  $('count').textContent = `${popped}/${L.n}`;
  $('pts').textContent = `${points} pts`;
  const q = $('quiver');
  if (q.children.length !== 3) q.innerHTML = ARROW_SVG.repeat(3);
  [...q.children].forEach((el, i) => el.classList.toggle('used', i >= arrowsLeft));
  const hint = $('hint');
  if (state === 'aim') hint.innerHTML = pulling ? `Power <b>${Math.round(pull * 100)}%</b> · let go to shoot`
    : shortPull ? 'Pull further back to shoot'
    : arrowsLeft === 3 && popped === 0 ? 'Pull back anywhere, let go to shoot<br><b>Harder pull, faster arrow</b>'
    : `Pull back to shoot · ${arrowsLeft} arrow${arrowsLeft > 1 ? 's' : ''} left`;
  else if (state === 'flight') hint.innerHTML = shot && !shot.splitUsed && shot.arrows.some(a => a.main && a.alive) ? '<b>Tap again to split!</b>' : '';
  else hint.innerHTML = '';
}
let comboTimer = 0;
function showCombo() {
  const el = $('combo');
  el.innerHTML = `${shot.combo} in a row${shot.mult > 1 ? ` ×${shot.mult}` : ''}<small>${shot.combo >= 12 ? 'unstoppable' : shot.combo >= 8 ? 'on fire' : 'combo'}</small>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(comboTimer); comboTimer = setTimeout(hideCombo, 1100);
}
function hideCombo() { $('combo').classList.remove('show'); }

function buildMenu() {
  $('lvls').innerHTML = LEVELS.map((lv, i) => {
    const bst = best[lv.name];
    const st = bst ? '★'.repeat(bst.stars) + '☆'.repeat(3 - bst.stars) : '☆☆☆';
    return `<button class="lvl" data-i="${i}"><span class="n">Level ${i + 1} · ${lv.n} balloons${lv.bow ? ' · rocking' : ''}${lv.wind ? ' · wind' : ''}</span><span class="t">${lv.name}</span><span class="s">${st} <span>${bst ? bst.pts + ' pts' : 'new'}</span></span></button>`;
  }).join('');
  $('lvls').querySelectorAll('.lvl').forEach(b => b.onclick = () => { audio(); startLevel(+b.dataset.i); });
}

// ---------- Sound (synthesised, nothing loaded) ----------
const { audio, tone, noise } = Sound;
muted = Sound.isMuted();
const PENTA = [0, 2, 4, 7, 9];
const sfx = {
  pop(n) { const i = n - 1, semi = Math.min(36, Math.floor(i / 5) * 12 + PENTA[i % 5]), f = 330 * Math.pow(2, semi / 12);
    noise(.06, .55, 2600, .8); tone(f, .22, 'triangle', .3); tone(f * 2, .1, 'sine', .1); },
  launch(p = .6) { noise(.1 + p * .08, .25 + p * .35, 700 + p * 600, .7); tone(160 + p * 120, .16, 'sawtooth', .08 + p * .08, 0, 70); tone(520 + p * 300, .08, 'square', .05, 0, 300); },
  creak(p) { tone(140 + p * 260, .05, 'square', .025); noise(.03, .08, 1200 + p * 1500, 4); },
  split() { noise(.18, .25, 4000, 2, 'highpass'); tone(880, .12, 'sine', .1, 0, 1320); },
  clank() { tone(620, .25, 'square', .08, 0, 590); tone(931, .3, 'triangle', .1); noise(.05, .4, 3000, 3); },
  boom() { noise(.45, .8, 180, .7, 'lowpass'); tone(90, .35, 'sine', .4, 0, 40); },
  chime() { [0, 4, 7].forEach((s, i) => tone(1046 * Math.pow(2, s / 12), .3, 'sine', .12, i * .05)); },
  settle() { tone(260, .18, 'sine', .08, 0, 200); },
  fanfare(st) { const seq = st === 3 ? [0, 4, 7, 12, 16] : st === 2 ? [0, 4, 7] : st === 1 ? [0, 4] : [0, -3];
    seq.forEach((s, i) => tone(523 * Math.pow(2, s / 12), .35, 'triangle', .18, i * .11)); }
};
function buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }
function setMuted(m) {
  Sound.setMuted(m); muted = m; $('soundBtn').textContent = m ? '🔇' : '🔊'; $('soundBtn').setAttribute('aria-label', m ? 'Sound off' : 'Sound on');
}

// ---------- Input ----------
// Press anywhere and drag down to draw the string back; let go to shoot. While an arrow flies, a tap splits it.
const pullPx = () => Math.min(190, H * .24);
function startPull(id, y) {
  if (state !== 'aim' || arrowsLeft <= 0 || pulling) return;
  pulling = true; pullId = id; pullStart = y; pull = 0; pullStep = 0; shortPull = false; updateHud();
}
function setPull(p) {
  pull = Math.max(0, Math.min(1, p));
  const st = Math.floor(pull * 10);
  if (st !== pullStep) { if (st > pullStep) { sfx.creak(pull); buzz(3); } pullStep = st; }
  updateHud();
}
function release() {
  if (!pulling) return;
  pulling = false; keyPull = false;
  if (state === 'aim' && pull >= .1) fire(pull);
  else if (state === 'aim') shortPull = true;
  pull = 0; updateHud();
}
function cancelPull() { pulling = false; keyPull = false; pull = 0; updateHud(); }
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); audio();
  if (state === 'flight') { split(); return; }
  startPull(e.pointerId, e.clientY);
  if (pulling) { try { cv.setPointerCapture(e.pointerId); } catch (err) {} }
}, { passive: false });
cv.addEventListener('pointermove', e => { if (pulling && e.pointerId === pullId) setPull((e.clientY - pullStart) / pullPx()); });
cv.addEventListener('pointerup', e => { if (pulling && e.pointerId === pullId) release(); });
cv.addEventListener('pointercancel', e => { if (pulling && e.pointerId === pullId) cancelPull(); });
// Keyboard: hold Space to draw (it fills in about a second), let go to shoot; Space mid-flight splits.
addEventListener('keydown', e => {
  if (!active || e.code !== 'Space' || !$('menu').hidden || !$('result').hidden) return;
  e.preventDefault(); audio();
  if (e.repeat) return;
  if (state === 'flight') split();
  else { startPull('key', 0); if (pulling) keyPull = true; }
});
addEventListener('keyup', e => { if (e.code === 'Space' && keyPull) release(); });
$('popHome').onclick = () => { audio(); App.go('home'); };
window.Popshot = {
  enter() { active = true; resize(); readColors(); muted = Sound.isMuted(); setMuted(muted); buildMenu(); cancelPull(); hideCombo(); state = 'menu'; $('result').hidden = true; $('menu').hidden = false; updateHud(); },
  leave() { active = false; cancelPull(); hideCombo(); }
};
$('menuBtn').onclick = () => { cancelPull(); buildMenu(); $('result').hidden = true; $('menu').hidden = false; state = 'menu'; hideCombo(); updateHud(); };
$('soundBtn').onclick = () => { audio(); setMuted(!muted); };
$('againBtn').onclick = () => { audio(); startLevel(li); };
$('nextBtn').onclick = () => { audio(); startLevel(li + 1); };

// ---------- Loop ----------
let last = performance.now(), acc = 0, lastRealDt = 0;
function frame(now) {
  if (!active) { last = now; requestAnimationFrame(frame); return; }
  const real = Math.min(.05, (now - last) / 1000); last = now; lastRealDt = real;
  updateWindChip();
  const scale = slowmo > 0 && !reduceMotion ? .3 : 1;
  slowmo = Math.max(0, slowmo - real);
  if (keyPull && pulling) setPull(pull + real * .9);
  acc += real * scale; let n = 0; while (acc >= DT && n < 40) { step(); acc -= DT; n++; }
  updateFx(real * scale);
  updateCamera(real);
  render();
  requestAnimationFrame(frame);
}
setMuted(muted);
startLevel(0); state = 'menu'; $('menu').hidden = false; buildMenu(); updateHud();
requestAnimationFrame(frame);
})();
