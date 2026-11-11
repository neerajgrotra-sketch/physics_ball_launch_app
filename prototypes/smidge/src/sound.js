// Shared synthesised sound for every game (nothing loaded). Starts on the first tap (browser rule).
const Sound = (() => {
  let ac = null, master = null, noiseBuf = null, muted = false;
  try { muted = localStorage.getItem('smidge/muted') === '1'; } catch (e) {}
  function audio() {
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain(); master.gain.value = muted ? 0 : .55; master.connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate * .5, ac.sampleRate);
        const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { ac = null; }
    }
    if (ac && ac.state === 'suspended') ac.resume();
  }
  function tone(f, dur, type, vol, delay = 0, f2) {
    if (!ac) return; const t0 = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + .005); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + .02);
  }
  function noise(dur, vol, freq, q = 1, type = 'bandpass', delay = 0) {
    if (!ac) return; const t0 = ac.currentTime + delay;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t0); s.stop(t0 + dur + .02);
  }
  function paintButtons() {
    document.querySelectorAll('[data-sound]').forEach(b => { b.textContent = muted ? '🔇' : '🔊'; b.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on'); });
  }
  function setMuted(m) {
    muted = m; if (master) master.gain.value = m ? 0 : .55;
    try { localStorage.setItem('smidge/muted', m ? '1' : '0'); } catch (e) {}
    paintButtons();
  }
  return { audio, tone, noise, setMuted, isMuted: () => muted, paintButtons };
})();
function haptic(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }
