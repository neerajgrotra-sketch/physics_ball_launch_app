// Shared synthesised sound for every game (nothing loaded). Starts on the first tap (browser rule).
const Sound = (() => {
  let ac = null, master = null, noiseBuf = null, muted = false;
  try { muted = localStorage.getItem('smidge/muted') === '1'; } catch (e) {}
  // iPhone rules (the same fixes as Clink):
  // 1. Web Audio obeys the ring/silent switch unless the page says it is media playback: navigator.audioSession
  //    (iOS 17+), or on older iOS a silent looping <audio> element, which moves the page into the playback category.
  // 2. Audio only starts inside a real touchend or click (pointerdown doesn't count), so a listener stays for good.
  // 3. iOS pauses the context after silence or an interruption (a call, locking); a tap resumes it, and one that
  //    finds it still stuck after an earlier resume replaces it.
  let unlocked = false, triedResume = 0, keepEl = null;
  function makeContext() {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = muted ? 0 : .55; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * .5, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      unlocked = false; triedResume = 0;
    } catch (e) { ac = null; }
  }
  function silentWav() {
    const n = 2205, b = new Uint8Array(44 + n), v = new DataView(b.buffer), w = (o, str) => { for (let i = 0; i < str.length; i++) b[o + i] = str.charCodeAt(i); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 22050, true); v.setUint32(28, 22050, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
    b.fill(128, 44);
    let bin = ''; for (const x of b) bin += String.fromCharCode(x);
    return 'data:audio/wav;base64,' + btoa(bin);
  }
  function playbackMode() {
    try { if (navigator.audioSession) { navigator.audioSession.type = 'playback'; return; } } catch (e) {}
    try {
      if (!keepEl) { keepEl = document.createElement('audio'); keepEl.src = silentWav(); keepEl.loop = true; keepEl.setAttribute('playsinline', ''); keepEl.setAttribute('x-webkit-airplay', 'deny'); }
      if (keepEl.paused) { const pr = keepEl.play(); if (pr && pr.catch) pr.catch(() => {}); }
    } catch (e) {}
  }
  function audio() {
    playbackMode();
    if (!ac) makeContext();
    if (!ac) return;
    if (ac.state === 'closed' || (ac.state !== 'running' && triedResume && performance.now() - triedResume > 500)) { try { ac.close(); } catch (e) {} makeContext(); if (!ac) return; }
    if (ac.state !== 'running') { if (!triedResume) triedResume = performance.now(); const pr = ac.resume(); if (pr && pr.then) pr.then(() => { if (ac && ac.state === 'running') triedResume = 0; }, () => {}); }
    else triedResume = 0;
    unlockPool();
    if (!unlocked) { try { const s = ac.createBufferSource(); s.buffer = ac.createBuffer(1, 1, 22050); s.connect(ac.destination); s.start(0); unlocked = true; } catch (e) {} }
  }
  for (const ev of ['touchend', 'click', 'keydown']) document.addEventListener(ev, audio, { capture: true, passive: true });
  // ---- backup path: when Web Audio isn't running (some in-app viewers never let it start), each sound is rendered
  // to a short WAV and played through a pool of <audio> elements unlocked during taps (iOS lets an element that has
  // played in a tap play again later with a new source).
  const SR = 22050, POOL = 10, pool = [], cache = new Map(); let poolIx = 0, lastErr = '';
  const webAudioOn = () => ac && ac.state === 'running';
  function unlockPool() {
    try {
      const silent = silentWav();
      while (pool.length < POOL) { const el = document.createElement('audio'); el.setAttribute('playsinline', ''); el.preload = 'auto'; el.src = silent; pool.push({ el, ok: false }); }
      for (const p of pool) if (!p.ok) { const pr = p.el.play(); if (pr && pr.then) pr.then(() => { p.ok = true; p.el.pause(); }, e => { lastErr = String(e && e.name || e); }); }
    } catch (e) { lastErr = String(e); }
  }
  function wav(samples) {
    const n = samples.length, b = new Uint8Array(44 + n * 2), v = new DataView(b.buffer), w = (o, str) => { for (let i = 0; i < str.length; i++) b[o + i] = str.charCodeAt(i); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 32000, true);
    let bin = ''; for (let i = 0; i < b.length; i += 8192) bin += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
    return 'data:audio/wav;base64,' + btoa(bin);
  }
  function renderTone(f, dur, type, vol, f2) {
    const n = Math.ceil((dur + .02) * SR), out = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR, fr = f2 ? f * Math.pow(f2 / f, Math.min(1, t / dur)) : f; ph += fr / SR; const x = ph % 1;
      const wv = type === 'sine' ? Math.sin(2 * Math.PI * x) : type === 'square' ? (x < .5 ? 1 : -1) * .6 : type === 'sawtooth' ? (2 * x - 1) * .7 : 1 - 4 * Math.abs(x - .5);
      const env = t < .005 ? t / .005 : Math.pow(.0001, Math.min(1, (t - .005) / Math.max(.01, dur - .005)));
      out[i] = wv * env * vol * .55 * 1.6;
    }
    return out;
  }
  function renderNoise(dur, vol, freq, type) {
    const n = Math.ceil((dur + .02) * SR), out = new Float32Array(n), k = Math.min(1, 2 * Math.PI * freq / SR); let lp = 0, lp2 = 0;
    for (let i = 0; i < n; i++) {
      const x = Math.random() * 2 - 1; lp += k * (x - lp); lp2 += k * ((x - lp) - lp2);
      const y = type === 'lowpass' ? lp * 1.5 : type === 'highpass' ? x - lp : lp2 * 2.2;
      out[i] = y * Math.pow(.0001, Math.min(1, i / SR / dur)) * vol * .55 * 1.6;
    }
    return out;
  }
  function playMedia(key, make, delay) {
    if (muted) return;
    let url = cache.get(key); if (!url) { url = wav(make()); if (cache.size > 160) cache.clear(); cache.set(key, url); }
    const go = () => {
      const ready = pool.filter(p => p.ok); if (!ready.length) return;
      const p = ready[poolIx++ % ready.length];
      try { p.el.pause(); p.el.src = url; p.el.currentTime = 0; const pr = p.el.play(); if (pr && pr.catch) pr.catch(e => { lastErr = String(e && e.name || e); }); } catch (e) { lastErr = String(e); }
    };
    delay > 0 ? setTimeout(go, delay * 1000) : go();
  }
  function tone(f, dur, type, vol, delay = 0, f2) {
    if (!webAudioOn()) return playMedia(['t', f | 0, dur.toFixed(3), type, vol.toFixed(3), f2 | 0].join(), () => renderTone(f, dur, type, vol, f2), delay);
    const t0 = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + .005); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + .02);
  }
  function noise(dur, vol, freq, q = 1, type = 'bandpass', delay = 0) {
    if (!webAudioOn()) return playMedia(['n', dur.toFixed(3), vol.toFixed(3), freq | 0, type].join(), () => renderNoise(dur, vol, freq, type), delay);
    const t0 = ac.currentTime + delay;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t0); s.stop(t0 + dur + .02);
  }
  // what the Sound check panel shows
  function report() {
    let inFrame = false; try { inFrame = window.top !== window; } catch (e) { inFrame = true; }
    return {
      webAudio: ac ? ac.state : (window.AudioContext || window.webkitAudioContext ? 'not started yet' : 'not available'),
      session: navigator.audioSession ? navigator.audioSession.type : 'not available (older iOS or not Safari)',
      media: `${pool.filter(p => p.ok).length} of ${pool.length || POOL} ready`,
      using: webAudioOn() ? 'Web Audio' : 'backup (audio elements)',
      frame: inFrame ? 'yes (embedded viewer)' : 'no', muted: muted ? 'yes' : 'no', error: lastErr || 'none',
    };
  }
  function testWeb() { audio(); if (!ac) return; const t0 = ac.currentTime; [0, 4, 7].forEach((st, i) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 523 * Math.pow(2, st / 12); g.gain.setValueAtTime(0, t0 + i * .12); g.gain.linearRampToValueAtTime(.3, t0 + i * .12 + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + i * .12 + .3); o.connect(g); g.connect(ac.destination); o.start(t0 + i * .12); o.stop(t0 + i * .12 + .32); }); }
  function testMedia() { audio(); const was = muted; muted = false; [0, 4, 7].forEach((st, i) => playMedia('test' + st, () => renderTone(523 * Math.pow(2, st / 12), .3, 'sine', .5), i * .12)); muted = was; }
  function paintButtons() {
    document.querySelectorAll('[data-sound]').forEach(b => { b.textContent = muted ? '🔇' : '🔊'; b.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on'); });
  }
  function setMuted(m) {
    muted = m; if (master) master.gain.value = m ? 0 : .55;
    try { localStorage.setItem('smidge/muted', m ? '1' : '0'); } catch (e) {}
    paintButtons();
  }
  return { audio, tone, noise, setMuted, isMuted: () => muted, paintButtons, report, testWeb, testMedia };
})();
function haptic(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }
// Seeded random numbers (same seed, same game) and the day number for daily rounds (day 1 = Monday 5 Jan 2026, local time).
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function dayNumber() { const now = new Date(), a = Date.UTC(2026, 0, 5), b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()); return Math.floor((b - a) / 864e5) + 1; }
function store(key, val) { try { if (val === undefined) return JSON.parse(localStorage.getItem(key) || 'null'); localStorage.setItem(key, JSON.stringify(val)); } catch (e) { return null; } }
async function copyText(text, btn) {
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {}
  if (btn) { const old = btn.dataset.label || btn.textContent; btn.dataset.label = old; btn.textContent = ok ? 'Copied' : 'Select the text below to copy'; setTimeout(() => { btn.textContent = old; }, 1600); }
  return ok;
}
