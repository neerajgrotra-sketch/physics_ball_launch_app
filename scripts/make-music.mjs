// Composes and synthesizes the game's background music, so every note is ours (no samples, no outside service, nothing to
// license). Two seamless loops:
//   graph-paper      regular mode: light and playful, 96 BPM, C major, plucked melody, electric piano, round bass, soft drums
//   asmr-neon-drift  ASMR mode: hypnotic, 70 BPM, C major pentatonic (the ASMR bounce chimes' notes), pads, drone, slow arpeggio
//   sketchbook       regular mode: Graph Paper's livelier, longer sibling, 112 BPM, 32 bars, offbeat piano, bouncier bass
//   asmr-felt-glass  ASMR mode: minimalist ambient, ~60 BPM, felt piano, airy pads, sustained tones, soft shimmer, no beat
//   protractor       regular mode: 100 BPM straight eighths, D minor into F major, marimba arpeggios, a whistled tune, rim-and-hat groove
//   asmr-paper-lanterns  ASMR mode: 64 BPM, kalimba in a lilting 3+3+2, warm low pads, a held root, faint rain and water drops
//   set-square       regular mode: a lilting 6/8 in G major, celesta tune, oom-pah-pah of plucked bass and strummed chords, whistle
//   asmr-tidewater   ASMR mode: 56 BPM, no beat, waves rolling in, glass-harmonica tones, a low bowed drone, gentle harp rolls
// The game plays one track per mode each session, the next one the session after (components/feedback/music.ts), so play stays fresh.
// Each is an exact number of bars. It's rendered once with its reverb and echo tails running past the end, then those tails are
// wrapped onto the start, which is exactly what the music sounds like looping forever: no gap, click or cut at the seam. Tones that
// run the whole loop (the drone, slow swells) are tuned to a whole number of cycles per loop for the same reason.
//
// Writes, for each track:
//   assets/music/<name>.mp3        the web copy: one pass plus its tail (the web player starts a repeat every loop length and
//                                  lets the tail overlap, so an MP3's few ms of encoder padding can't make a gap)
//   assets/music/<name>.json       { loop: seconds } for that player
//   assets/music/loops/<name>.wav  the phones' copy: the wrapped loop itself (expo-audio loops the whole file)
// Deterministic (seeded): re-running it gives the same music. Needs ffmpeg for the MP3. Run: node scripts/make-music.mjs [name]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MUSIC = path.join(root, 'assets', 'music');
const SR = 44100;
const TAIL = 4; // seconds of reverb/echo rendered past the loop end, then wrapped onto its start

// ---------------------------------------------------------------- helpers

const midi = (m) => 440 * 2 ** ((m - 69) / 12);
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** A stereo mix bus. */
class Bus {
  /** `loop` (seconds): a note starting before 0 (a swell into the first bar) wraps round to the end of the loop. */
  constructor(seconds, loop = 0) {
    this.n = Math.ceil(seconds * SR); this.l = new Float32Array(this.n); this.r = new Float32Array(this.n); this.loopN = Math.round(loop * SR);
  }
  /** Adds a mono signal (Float32Array) starting at time t, with gain and pan (-1 left … 1 right, equal power). */
  add(sig, t, gain = 1, pan = 0) {
    const start = Math.round(t * SR);
    const a = ((pan + 1) * Math.PI) / 4, gl = Math.cos(a) * gain, gr = Math.sin(a) * gain;
    for (let i = 0; i < sig.length; i++) {
      let j = start + i;
      if (j < 0 && this.loopN) j += this.loopN;
      if (j < 0 || j >= this.n) continue;
      this.l[j] += sig[i] * gl; this.r[j] += sig[i] * gr;
    }
  }
  mixInto(other, gain = 1) { for (let i = 0; i < this.n; i++) { other.l[i] += this.l[i] * gain; other.r[i] += this.r[i] * gain; } }
}

/** One-pole low-pass over a signal, in place. */
function lowpass(sig, cutoff) {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  let y = 0;
  for (let i = 0; i < sig.length; i++) { y += a * (sig[i] - y); sig[i] = y; }
  return sig;
}

/** Attack / exponential-decay envelope with a soft release at the end. */
function env(i, len, attack, tau) {
  const t = i / SR, rel = Math.min(1, (len - i) / (0.03 * SR));
  return Math.min(1, t / attack) * Math.exp(-t / tau) * rel;
}

// ---------------------------------------------------------------- instruments (each returns a mono Float32Array)

/** A plucked string (Karplus-Strong): a burst of seeded noise circulating in a tuned delay line, softened a little each pass. */
function pluck(freq, dur, { bright = 0.5, decay = 0.996, seed = 1, attack = 0 } = {}) {
  const n = Math.round(dur * SR), out = new Float32Array(n);
  const p = Math.max(2, Math.round(SR / freq)), line = new Float32Array(p), rand = rng(seed + Math.round(freq));
  for (let i = 0; i < p; i++) line[i] = rand() * 2 - 1;
  lowpass(line, 1500 + bright * 6000);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const next = (k + 1) % p;
    const v = line[k];
    line[k] = decay * 0.5 * (v + line[next]);
    out[i] = v * Math.min(1, (n - i) / (0.02 * SR)) * (attack ? Math.min(1, i / (attack * SR)) : 1);
    k = next;
  }
  return out;
}

/** An electric piano: two-operator FM, the bell-like brightness fading quickly into a warm tone, plus a faint tine. */
function epiano(freq, dur, { tau = 1.1, index = 1.6 } = {}) {
  const n = Math.round(dur * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR, I = index * Math.exp(-t / 0.25) + 0.25;
    const mod = Math.sin(2 * Math.PI * freq * t);
    const tone = Math.sin(2 * Math.PI * freq * t + I * mod);
    const tine = 0.12 * Math.sin(2 * Math.PI * freq * 7 * t) * Math.exp(-t / 0.04);
    out[i] = (tone + tine) * env(i, n, 0.004, tau);
  }
  return out;
}

/** A soft bell (FM at an inharmonic ratio), for the ASMR arpeggio and sparkles. */
function bell(freq, dur, { tau = 1.6, index = 0.9 } = {}) {
  const n = Math.round(dur * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR, I = index * Math.exp(-t / 0.6);
    out[i] = Math.sin(2 * Math.PI * freq * t + I * Math.sin(2 * Math.PI * freq * 3.5 * t)) * env(i, n, 0.01, tau);
  }
  return out;
}

/** A warm pad note: detuned, softly bright partials, a slow swell in and out, low-passed. */
function pad(freq, dur, { attack = 1.4, release = 2.2, cutoff = 1400, seed = 3 } = {}) {
  const n = Math.round(dur * SR), out = new Float32Array(n), rand = rng(seed + Math.round(freq * 10));
  const voices = [-7, 0, 6].map((cents) => ({ f: freq * 2 ** (cents / 1200), ph: rand() * Math.PI * 2 }));
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (const { f, ph } of voices) for (let h = 1; h <= 5; h++) v += Math.sin(2 * Math.PI * f * h * t + ph * h) / (h * h * 0.7 + 0.3);
    const e = Math.min(1, t / attack) * Math.min(1, (n - i) / (release * SR));
    out[i] = v * e * e * 0.18;
  }
  return lowpass(out, cutoff);
}

/** A round bass note: a sine and a touch of its octave, a soft pluck in, a quick-ish decay. */
function bass(freq, dur) {
  const n = Math.round(dur * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = (Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(4 * Math.PI * freq * t) * Math.exp(-t / 0.08)) * env(i, n, 0.006, 0.6);
  }
  return out;
}

/** A soft kick: a sine falling in pitch, short. */
function kick() {
  const n = Math.round(0.35 * SR), out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = 45 + 70 * Math.exp(-t / 0.035);
    ph += (2 * Math.PI * f) / SR;
    out[i] = Math.sin(ph) * Math.exp(-t / 0.14) * Math.min(1, t / 0.002);
  }
  return out;
}

/** Noise bursts: a shaker (bright, very short) or a finger snap (a little body, short). Seeded per hit. */
function noiseHit(kind, seed) {
  const len = kind === 'shaker' ? 0.06 : kind === 'hat' ? 0.16 : 0.12, n = Math.round(len * SR), out = new Float32Array(n), rand = rng(seed);
  let prev = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, w = rand() * 2 - 1;
    const hp = w - prev; prev = w; // high-passed
    lp += 0.35 * (w - lp);          // band-ish for the snap
    const tone = kind === 'snap' ? 0.6 * lp + 0.4 * hp : hp;
    out[i] = tone * Math.exp(-t / (kind === 'shaker' ? 0.012 : kind === 'hat' ? 0.045 : 0.03)) * Math.min(1, t / 0.0015);
  }
  return out;
}

/**
 * A muted felt piano: a few slightly stretched partials (real strings run a touch sharp up the series), each fading faster the higher
 * it is, a soft felt-hammer attack instead of a bright strike, a low-pass to keep the treble restrained, and a damper at the end.
 */
function feltPiano(freq, dur, { vel = 0.7, seed = 9 } = {}) {
  const n = Math.round(dur * SR), out = new Float32Array(n), B = 0.0004;
  const partials = [1, 2, 3, 4, 5].map((k) => ({ f: freq * k * Math.sqrt(1 + B * k * k), a: [1, 0.45, 0.2, 0.09, 0.04][k - 1], tau: 2.6 / (1 + 0.9 * (k - 1)) }));
  const rand = rng(seed + Math.round(freq));
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (const p of partials) v += p.a * Math.sin(2 * Math.PI * p.f * t) * Math.exp(-t / p.tau);
    // The felt: a short, dark thump of noise as the hammer lands.
    lp += 0.08 * ((rand() * 2 - 1) - lp);
    v += lp * 1.2 * Math.exp(-t / 0.018);
    out[i] = v * Math.min(1, t / 0.012) * Math.min(1, (n - i) / (0.25 * SR)) * vel;
  }
  return lowpass(lowpass(out, 1800), 2600);
}

/** An airy pad: soft near-sine voices with a breath of filtered noise around them, swelling slowly in and out. */
function airPad(freq, dur, { attack = 3, release = 3.5, seed = 11 } = {}) {
  const n = Math.round(dur * SR), out = new Float32Array(n), rand = rng(seed + Math.round(freq * 10));
  const voices = [-5, 0, 4].map((cents) => ({ f: freq * 2 ** (cents / 1200), ph: rand() * Math.PI * 2 }));
  const air = new Float32Array(n);
  for (let i = 0; i < n; i++) air[i] = rand() * 2 - 1;
  lowpass(lowpass(air, freq * 2.2), freq * 2.2); // breath centred on the note's own region
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (const { f, ph } of voices) v += Math.sin(2 * Math.PI * f * t + ph) + 0.18 * Math.sin(4 * Math.PI * f * t + ph);
    const e = Math.min(1, t / attack) * Math.min(1, (n - i) / (release * SR));
    out[i] = (v * 0.22 + air[i] * 0.9) * e * e;
  }
  return lowpass(out, 1600);
}

/** A sustained tone: a plain sine with its octave, breathing very slowly, for long held notes under the piano. */
function sustain(freq, dur, { attack = 2.5, release = 3, breathe = 0.12 } = {}) {
  const n = Math.round(dur * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = Math.min(1, t / attack) * Math.min(1, (n - i) / (release * SR));
    out[i] = (Math.sin(2 * Math.PI * freq * t) + 0.2 * Math.sin(4 * Math.PI * freq * t)) * e * e * (1 - breathe + breathe * Math.sin(2 * Math.PI * 0.11 * t));
  }
  return out;
}

/** Shimmer: a high, very soft cluster that flickers gently (slow, out-of-step tremolos), kept dark so it sparkles without glare. */
function shimmer(freq, dur, { seed = 21 } = {}) {
  const n = Math.round(dur * SR), out = new Float32Array(n), rand = rng(seed + Math.round(freq));
  const parts = [1, 1.5, 2].map((r) => ({ f: freq * r, rate: 0.3 + rand() * 0.5, ph: rand() * 6.28 }));
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (const p of parts) v += Math.sin(2 * Math.PI * p.f * t) * (0.5 + 0.5 * Math.sin(2 * Math.PI * p.rate * t + p.ph));
    const e = Math.min(1, t / 2.5) * Math.min(1, (n - i) / (3 * SR));
    out[i] = v * e * e;
  }
  return lowpass(out, 3500);
}

/** A marimba: a wooden bar's partials (the 4th and 10th, not the octave), each dying faster than the one below, a soft mallet. */
function marimba(freq, dur, { tau = 0.45 } = {}) {
  const n = Math.round(dur * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const v = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t / tau)
      + 0.2 * Math.sin(2 * Math.PI * freq * 3.99 * t) * Math.exp(-t / (tau * 0.16))
      + 0.1 * Math.sin(2 * Math.PI * freq * 9.8 * t) * Math.exp(-t / (tau * 0.05));
    out[i] = v * Math.min(1, t / 0.0015) * Math.min(1, (n - i) / (0.03 * SR));
  }
  return out;
}

/** A whistle: a near-pure tone gliding up into the note, with a vibrato that grows as it's held and a breath of air on top. */
function whistle(freq, dur, { seed = 31, vib = 5.4, depth = 0.009 } = {}) {
  const n = Math.round(dur * SR), out = new Float32Array(n), rand = rng(seed + Math.round(freq));
  let ph = 0, air = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const scoop = 1 - 0.03 * Math.exp(-t / 0.04);
    const f = freq * scoop * (1 + depth * Math.min(1, t / 0.35) * Math.sin(2 * Math.PI * vib * t));
    ph += (2 * Math.PI * f) / SR;
    air += 0.2 * ((rand() * 2 - 1) - air);
    const e = Math.min(1, t / 0.05) * Math.min(1, (n - i) / (0.12 * SR)) * (0.85 + 0.15 * Math.exp(-t / 0.3));
    out[i] = (Math.sin(ph) + 0.06 * Math.sin(2 * ph) + 0.05 * air) * e;
  }
  return out;
}

/** A kalimba tine: a soft sine with a bright, inharmonic overtone that dies at once, and a tiny click of the thumb. */
function kalimba(freq, dur, { tau = 1.3 } = {}) {
  const n = Math.round(dur * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const v = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t / tau)
      + 0.22 * Math.sin(2 * Math.PI * freq * 5.95 * t) * Math.exp(-t / 0.05)
      + 0.08 * Math.sin(2 * Math.PI * freq * 2 * t) * Math.exp(-t / (tau * 0.4));
    out[i] = v * Math.min(1, t / 0.004) * Math.min(1, (n - i) / (0.05 * SR));
  }
  return lowpass(out, 5000);
}

/** A water drop: a tiny sine that rises fast in pitch as it fades (the "plip" of a drop on still water). */
function drop(freq) {
  const n = Math.round(0.09 * SR), out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = freq * (1 + 0.9 * (1 - Math.exp(-t / 0.012)));
    ph += (2 * Math.PI * f) / SR;
    out[i] = Math.sin(ph) * Math.exp(-t / 0.018) * Math.min(1, t / 0.001);
  }
  return out;
}

/** A celesta: a bright, bell-like FM tone with a quick shimmer that settles into a pure ring (higher and shorter than bell()). */
function celesta(freq, dur, { tau = 0.9 } = {}) {
  const n = Math.round(dur * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR, I = 1.4 * Math.exp(-t / 0.12);
    const v = Math.sin(2 * Math.PI * freq * t + I * Math.sin(2 * Math.PI * freq * 4 * t)) + 0.18 * Math.sin(2 * Math.PI * freq * 2 * t) * Math.exp(-t / 0.2);
    out[i] = v * env(i, n, 0.002, tau);
  }
  return lowpass(out, 6000);
}

/** A glass harmonica: near-pure tones (a whisper of the octave and twelfth) that swell in slowly, with a slow shimmer of vibrato. */
function glassHarp(freq, dur, { attack = 2.2, release = 2.8, seed = 41 } = {}) {
  const n = Math.round(dur * SR), out = new Float32Array(n), rand = rng(seed + Math.round(freq));
  const rate = 4 + rand() * 1.2, ph = rand() * 6.28;
  let p = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = freq * (1 + 0.0025 * Math.sin(2 * Math.PI * rate * t + ph));
    p += (2 * Math.PI * f) / SR;
    const e = Math.min(1, t / attack) * Math.min(1, (n - i) / (release * SR));
    out[i] = (Math.sin(p) + 0.12 * Math.sin(2 * p) + 0.04 * Math.sin(3 * p)) * e * e;
  }
  return out;
}

/** A low bowed string: a few soft harmonics, a slow bow-in and out, a gentle breath of bow noise, kept dark. */
function bowed(freq, dur, { attack = 1.6, release = 2.2, seed = 51 } = {}) {
  const n = Math.round(dur * SR), out = new Float32Array(n), rand = rng(seed + Math.round(freq));
  let nz = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (let h = 1; h <= 6; h++) v += Math.sin(2 * Math.PI * freq * h * t + h * 0.7) / (h * 1.4);
    nz += 0.05 * ((rand() * 2 - 1) - nz);
    const e = Math.min(1, t / attack) * Math.min(1, (n - i) / (release * SR));
    out[i] = (v * (1 + 0.04 * Math.sin(2 * Math.PI * 0.3 * t)) + nz * 0.6) * e * e;
  }
  return lowpass(lowpass(out, 900), 1400);
}

// ---------------------------------------------------------------- effects

/** A small Freeverb: parallel damped combs into series all-passes, per channel. Returns a new wet bus. */
function reverb(bus, { room = 0.82, damp = 0.35 } = {}) {
  const out = new Bus(bus.n / SR);
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], alls = [556, 441, 341, 225];
  for (const [src, dst, spread] of [[bus.l, out.l, 0], [bus.r, out.r, 23]]) {
    const acc = new Float32Array(bus.n);
    for (const len0 of combs) {
      const len = len0 + spread, buf = new Float32Array(len);
      let k = 0, store = 0;
      for (let i = 0; i < bus.n; i++) {
        const y = buf[k];
        store = y * (1 - damp) + store * damp;
        buf[k] = src[i] * 0.015 + store * room;
        acc[i] += y;
        k = (k + 1) % len;
      }
    }
    for (const len0 of alls) {
      const len = len0 + spread, buf = new Float32Array(len);
      let k = 0;
      for (let i = 0; i < bus.n; i++) {
        const b = buf[k], y = -acc[i] + b;
        buf[k] = acc[i] + b * 0.5;
        acc[i] = y;
        k = (k + 1) % len;
      }
    }
    dst.set(acc);
  }
  return out;
}

/** A ping-pong echo: left and right taps alternate, each quieter and a little darker. Returns a new wet bus. */
function pingPong(bus, delay, feedback, cutoff = 3000) {
  const out = new Bus(bus.n / SR), d = Math.round(delay * SR);
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  let fl = 0, fr = 0;
  for (let i = d; i < bus.n; i++) {
    // Cross-feed: what went into the left comes back on the right, and so on.
    fl += a * (bus.r[i - d] + out.r[i - d] * feedback - fl);
    fr += a * (bus.l[i - d] + out.l[i - d] * feedback - fr);
    out.l[i] = fl; out.r[i] = fr;
  }
  return out;
}

// ---------------------------------------------------------------- the tracks

/** Regular mode: "Graph Paper". 96 BPM, 16 bars of 4/4, C major. */
function graphPaper() {
  const bpm = 96, beat = 60 / bpm, bar = 4 * beat, bars = 16, L = bars * bar;
  const total = L + TAIL;
  const dry = new Bus(total), send = new Bus(total);
  const swing = (b) => { const whole = Math.floor(b), frac = b - whole; return whole + (Math.abs(frac - 0.5) < 1e-6 ? 0.56 : frac); };
  const at = (barNo, b) => barNo * bar + swing(b) * beat;
  // Chords: an A section (C Am F G, twice) and a B section that lifts and comes home.
  const chords = [
    ['C', [60, 64, 67, 71], 36], ['Am', [57, 60, 64, 67], 33], ['F', [53, 57, 60, 64], 41], ['G', [55, 59, 62, 64], 43],
    ['C', [60, 64, 67, 71], 36], ['Am', [57, 60, 64, 67], 33], ['F', [53, 57, 60, 64], 41], ['G', [55, 59, 62, 64], 43],
    ['F', [53, 57, 60, 64], 41], ['G', [55, 59, 62, 64], 43], ['Em', [52, 55, 59, 62], 40], ['Am', [57, 60, 64, 67], 33],
    ['F', [53, 57, 60, 64], 41], ['G', [55, 59, 62, 64], 43], ['C', [60, 64, 67, 71], 36], ['Csus', [60, 62, 67, 72], 36],
  ];
  const rand = rng(2026);
  const PENTA = [72, 74, 76, 79, 81]; // C5 D5 E5 G5 A5
  let mel = 2; // index into PENTA
  chords.forEach(([, voicing, root], i) => {
    const b = i >= 8; // B section
    // Electric piano: a chord on 1 and a lighter push on the and of 2 (and a touch on 4 in the B section).
    const stab = (beatAt, dur, g) => voicing.forEach((m, k) => {
      const s = epiano(midi(m), dur * beat + 0.8);
      dry.add(s, at(i, beatAt), g * 0.26, (k - 1.5) * 0.25);
      send.add(s, at(i, beatAt), g * 0.07, (k - 1.5) * 0.25);
    });
    stab(0, 1.6, 1);
    stab(1.5, 1.4, 0.65);
    if (b) stab(3, 0.9, 0.45);
    // Bass: root, fifth, a little octave hop.
    const bn = (beatAt, m, dur, g) => dry.add(bass(midi(m + 12), dur * beat), at(i, beatAt), g * 0.34); // an octave up: phone speakers can't play the low one
    bn(0, root, 1.4, 1); bn(2, root + 7, 0.9, 0.8); bn(3.5, root + 12, 0.4, 0.55);
    // Drums: soft kick on 1 and 3 (and the and of 3 on even bars), snaps on 2 and 4, shaker on every eighth.
    for (const kb of [0, 2, ...(i % 2 ? [2.5] : [])]) dry.add(kick(), at(i, kb), 0.26);
    for (const sb of [1, 3]) { const s = noiseHit('snap', i * 10 + sb); dry.add(s, at(i, sb), 0.18, 0.15); send.add(s, at(i, sb), 0.05); }
    for (let e = 0; e < 8; e++) dry.add(noiseHit('shaker', i * 100 + e), at(i, e / 2), e % 2 ? 0.07 : 0.04, 0.4);
    // Melody: plucks on the eighths, chord tones on the strong beats, stepping through the pentatonic. Bars 1–2 rest, so the loop
    // breathes; the B section plays a bit more.
    if (i < 2) return;
    const chordPcs = voicing.map((m) => m % 12);
    for (let e = 0; e < 8; e++) {
      const strong = e % 2 === 0;
      const play = strong ? rand() < (b ? 0.9 : 0.75) : rand() < (b ? 0.45 : 0.3);
      if (!play) continue;
      mel = Math.max(0, Math.min(PENTA.length - 1, mel + Math.round((rand() - 0.5) * 2.6)));
      if (strong && !chordPcs.includes(PENTA[mel] % 12)) {
        // Nudge onto a chord tone on the strong eighths.
        const near = PENTA.map((m, k) => [k, chordPcs.includes(m % 12)]).filter(([, ok]) => ok).map(([k]) => k);
        if (near.length) mel = near.reduce((a, k) => (Math.abs(k - mel) < Math.abs(a - mel) ? k : a), near[0]);
      }
      const s = pluck(midi(PENTA[mel]), 1.4, { bright: 0.45, decay: 0.997, seed: i * 8 + e });
      const tt = at(i, e / 2);
      dry.add(s, tt, 0.5, 0.2);
      send.add(s, tt, 0.17, 0.2);
    }
  });
  const wet = reverb(send, { room: 0.8, damp: 0.4 });
  wet.mixInto(dry, 1);
  return { name: 'graph-paper', L, bus: dry };
}

/** ASMR mode: "Neon Drift". 70 BPM, 12 bars of 4/4, C major pentatonic only (the notes the ASMR bounce chimes play). */
function neonDrift() {
  const bpm = 70, beat = 60 / bpm, bar = 4 * beat, bars = 12, L = bars * bar;
  const total = L + TAIL;
  const dry = new Bus(total, L), send = new Bus(total, L), echo = new Bus(total, L);
  // A whole number of cycles per loop, so tones that run right through it meet themselves at the seam.
  const loopTuned = (f) => Math.round(f * L) / L;
  // Chords, two bars each, from C D E G A only.
  const chords = [
    [55, 60, 62, 64], // Cadd9
    [57, 60, 64, 67], // Am7
    [55, 57, 62, 64], // G6sus
    [55, 60, 62, 64], // Cadd9
    [52, 55, 59, 62], // Em7 (B as a passing colour inside the pad)
    [50, 55, 57, 62], // Dsus
  ];
  chords.forEach((voicing, c) => {
    const t = c * 2 * bar - 1.0; // swell in a little early, so each chord blooms on its downbeat
    voicing.forEach((m, k) => {
      const s = pad(midi(m), 2 * bar + 3.2, { attack: 1.8, release: 2.6, cutoff: 1100, seed: c * 4 + k });
      dry.add(s, t, 0.3, (k - 1.5) * 0.4);
      send.add(s, t, 0.22, (k - 1.5) * 0.4);
    });
  });
  // Drone: C2 and G2 all the way through, breathing slowly (two breaths per chord change).
  const n = Math.ceil(total * SR), drone = new Float32Array(n);
  const f1 = loopTuned(midi(36)), f2 = loopTuned(midi(43)), breath = loopTuned(1 / (2 * bar));
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const swell = 0.75 + 0.25 * Math.sin(2 * Math.PI * breath * t);
    // C2 and G2 with their octaves, so a phone speaker (which can't play the fundamentals) still hears the drone.
    drone[i] = (0.6 * Math.sin(2 * Math.PI * f1 * t) + 0.35 * Math.sin(2 * Math.PI * f2 * t) + 0.45 * Math.sin(4 * Math.PI * f1 * t) + 0.25 * Math.sin(4 * Math.PI * f2 * t)) * swell;
  }
  // The drone runs over the whole render; only its first L seconds are the loop, the rest would double up when wrapped.
  dry.add(drone.subarray(0, Math.round(L * SR)), 0, 0.07);
  // Arpeggio: soft bells on the eighths, up and down the chord's pentatonic notes, with gaps to breathe, into a ping-pong echo.
  const rand = rng(70);
  for (let b = 0; b < bars; b++) {
    const voicing = chords[Math.floor(b / 2)].map((m) => m + 12);
    const notes = [...new Set([...voicing, voicing[0] + 12, voicing[1] + 12])].sort((x, y) => x - y).filter((m) => m >= 55 && m <= 79);
    const pattern = [0, 1, 2, 3, 2, 1, 2, 3];
    for (let e = 0; e < 8; e++) {
      if (rand() < 0.22) continue; // a breath
      const m = notes[pattern[e] % notes.length];
      const s = bell(midi(m), 2.4, { tau: 1.2, index: 0.7 });
      const tt = b * bar + (e / 2) * beat;
      dry.add(s, tt, 0.24, e % 2 ? 0.35 : -0.35);
      echo.add(s, tt, 0.13);
      send.add(s, tt, 0.08);
    }
    // A sparkle now and then: a high bell, soft, lots of space round it.
    if (b % 2 === 1) {
      const m = [84, 86, 88, 91, 93][Math.floor(rand() * 5)];
      const s = bell(midi(m), 4, { tau: 2.2, index: 0.5 });
      const tt = b * bar + (1 + Math.floor(rand() * 3)) * beat;
      dry.add(s, tt, 0.09, rand() * 1.2 - 0.6);
      send.add(s, tt, 0.08);
    }
  }
  // A faint warm hiss, like tape, through the whole loop.
  const hiss = new Float32Array(Math.round(L * SR)), hr = rng(5);
  for (let i = 0; i < hiss.length; i++) hiss[i] = hr() * 2 - 1;
  lowpass(lowpass(hiss, 2500), 2500);
  dry.add(hiss, 0, 0.02);
  const wetE = pingPong(echo, 3 * beat / 2, 0.45, 2600);
  wetE.mixInto(dry, 0.8);
  wetE.mixInto(send, 0.4);
  const wet = reverb(send, { room: 0.9, damp: 0.3 });
  wet.mixInto(dry, 1.2);
  return { name: 'asmr-neon-drift', L, bus: dry };
}

/**
 * Regular mode: "Sketchbook", Graph Paper's livelier, longer sibling. 112 BPM, 32 bars of 4/4 (about 69 s), C major. Four
 * sections: a verse, a lift, a section with a counter-melody and open hi-hats, and the verse again with a variation. Offbeat
 * piano stabs, a bouncing eighth-note bass, claps on 2 and 4, and a catchy motif per section.
 */
function sketchbook() {
  const bpm = 112, beat = 60 / bpm, bar = 4 * beat, bars = 32, L = bars * bar;
  const total = L + TAIL;
  const dry = new Bus(total, L), send = new Bus(total, L);
  const swing = (b) => { const whole = Math.floor(b), frac = b - whole; return whole + (Math.abs(frac - 0.5) < 1e-6 ? 0.54 : frac); };
  const at = (barNo, b) => barNo * bar + swing(b) * beat;
  const C = [[60, 64, 67, 72], 36], G = [[59, 62, 67, 71], 43], Am = [[57, 60, 64, 69], 33], F = [[57, 60, 65, 69], 41], Em = [[55, 59, 64, 67], 40], Dm = [[57, 62, 65, 69], 38];
  const sections = [
    [C, G, Am, F, C, G, F, G],     // verse
    [F, G, Em, Am, Dm, G, C, C],   // lift
    [Am, F, C, G, Am, F, Dm, G],   // counter-melody
    [C, G, Am, F, C, G, F, C],     // verse again, home
  ];
  const PENTA = [72, 74, 76, 79, 81, 84]; // C5 D5 E5 G5 A5 C6
  sections.forEach((chords, sec) => {
    // One motif per section (seeded), repeated with small changes each bar, so it's catchy rather than random.
    const rand = rng(1120 + sec * 7);
    const motif = Array.from({ length: 8 }, (_, e) => (rand() < (e % 2 ? 0.45 : 0.85) ? Math.floor(rand() * PENTA.length) : -1));
    chords.forEach(([voicing, root], k) => {
      const i = sec * 8 + k;
      // Piano: a chord on 1, then bright offbeat stabs on the "and"s of 2 and 4 (the upbeat lift).
      const stab = (b, dur, g) => voicing.forEach((m, v) => {
        const sg = epiano(midi(m), dur * beat + 0.5, { tau: 0.7, index: 1.9 });
        dry.add(sg, at(i, b), g * 0.22, (v - 1.5) * 0.25);
        send.add(sg, at(i, b), g * 0.06, (v - 1.5) * 0.25);
      });
      stab(0, 1, 1); stab(1.5, 0.45, 0.75); stab(3.5, 0.45, 0.75);
      // Bass: bouncing eighths, root-root-fifth-octave, an octave up for phone speakers.
      [[0, 0, 0.55], [1, 0, 0.4], [1.5, 7, 0.4], [2, 0, 0.55], [3, 12, 0.4], [3.5, 7, 0.4]].forEach(([b, iv, d]) =>
        dry.add(bass(midi(root + 12 + iv), d * beat), at(i, b), b % 2 ? 0.26 : 0.34));
      // Drums: kick on 1 and 3 with a pickup, claps on 2 and 4, shaker on every eighth, open hats on the offbeats in section 3.
      for (const kb of [0, 2, ...(k % 2 ? [3.5] : [])]) dry.add(kick(), at(i, kb), 0.28);
      for (const sb of [1, 3]) { const sg = noiseHit('snap', i * 10 + sb); dry.add(sg, at(i, sb), 0.26, 0.1); send.add(sg, at(i, sb), 0.06); }
      for (let e = 0; e < 8; e++) dry.add(noiseHit('shaker', 5000 + i * 100 + e), at(i, e / 2), e % 2 ? 0.08 : 0.05, 0.4);
      if (sec === 2) for (const hb of [0.5, 1.5, 2.5, 3.5]) dry.add(noiseHit('hat', 7000 + i * 10 + hb * 2), at(i, hb), 0.07, -0.35);
      // Melody: the section's motif, nudged onto chord tones on the strong eighths, a little different on odd bars.
      const pcs = voicing.map((m) => m % 12);
      motif.forEach((idx, e) => {
        if (idx < 0) return;
        let j = Math.min(PENTA.length - 1, idx + (k % 2 && e > 4 ? 1 : 0));
        if (e % 2 === 0 && !pcs.includes(PENTA[j] % 12)) {
          const near = PENTA.map((m, q) => (pcs.includes(m % 12) ? q : -1)).filter((q) => q >= 0);
          if (near.length) j = near.reduce((a, q) => (Math.abs(q - j) < Math.abs(a - j) ? q : a), near[0]);
        }
        const sg = pluck(midi(PENTA[j]), 1.1, { bright: 0.6, decay: 0.996, seed: i * 8 + e, attack: 0.002 });
        dry.add(sg, at(i, e / 2), 0.46, 0.2);
        send.add(sg, at(i, e / 2), 0.15, 0.2);
      });
      // Counter-melody in section 3: a high pluck answering on the last eighth of each bar.
      if (sec === 2) {
        const sg = pluck(midi(voicing[2] + 12), 0.9, { bright: 0.7, seed: 900 + i, attack: 0.002 });
        dry.add(sg, at(i, 3.5), 0.22, -0.4);
        send.add(sg, at(i, 3.5), 0.1);
      }
    });
  });
  const wet = reverb(send, { room: 0.78, damp: 0.42 });
  wet.mixInto(dry, 1);
  return { name: 'sketchbook', L, bus: dry };
}

/**
 * ASMR mode: "Felt Glass", minimalist ambient. About 60 BPM, 16 bars of 4/4 (64 s), simple consonant chords in C. Soft airy pads
 * that cross-fade from chord to chord, gentle sustained tones, a very sparse felt-piano melody played a little loosely, a faint
 * high shimmer and a soft low root. No drums, no beat, no bright bells, no builds: a continuous texture with no clear start or end,
 * quiet and even, leaving the treble free for the game's glass clinks and chimes.
 */
function feltGlass() {
  const bpm = 60, beat = 60 / bpm, bar = 4 * beat, bars = 16, L = bars * bar;
  const total = L + TAIL + 2;
  const dry = new Bus(total, L), send = new Bus(total, L);
  // Two bars per chord; each voicing stays close to the last, so the changes are barely felt.
  const chords = [
    [[48, 55, 64, 67, 71], 36], // Cmaj7
    [[45, 52, 60, 64, 67], 33], // Am7
    [[41, 53, 57, 60, 64], 29], // Fmaj7
    [[43, 50, 55, 62, 64], 31], // G6
    [[48, 55, 62, 64, 67], 36], // Cadd9
    [[40, 52, 55, 59, 64], 28], // Em7
    [[41, 53, 57, 64, 67], 29], // Fmaj9 (no 3rd doubling)
    [[43, 50, 55, 60, 62], 31], // Gsus
  ];
  const rand = rng(6060);
  chords.forEach(([voicing, root], c) => {
    const t0 = c * 2 * bar - 2.5; // each pad swells in ahead of its chord, under the one before
    voicing.slice(1).forEach((m, k) => {
      const sg = airPad(midi(m), 2 * bar + 6, { attack: 3.2, release: 3.8, seed: c * 5 + k });
      dry.add(sg, t0, 0.2, (k - 1.5) * 0.45);
      send.add(sg, t0, 0.2, (k - 1.5) * 0.45);
    });
    // A gentle low root, held, and a sustained middle tone that drifts across the change.
    dry.add(sustain(midi(root + 12), 2 * bar + 5, { attack: 3, release: 3.5 }), t0, 0.065);
    const held = sustain(midi(voicing[2] + 12), 2 * bar + 4, { attack: 3.5, release: 3.5, breathe: 0.2 });
    dry.add(held, t0 + 1, 0.05, c % 2 ? 0.3 : -0.3);
    send.add(held, t0 + 1, 0.06);
    // Felt piano: one to three soft notes per chord, from its own tones, placed loosely (never on a strict grid).
    const tones = voicing.slice(2).map((m) => m + 12).filter((m) => m >= 60 && m <= 79);
    const count = 1 + Math.floor(rand() * 2.6);
    for (let q = 0; q < count; q++) {
      const m = tones[Math.floor(rand() * tones.length)];
      const when = c * 2 * bar + (0.4 + q * 2.6 + rand() * 1.2) * beat;
      const sg = feltPiano(midi(m), 5, { vel: 0.5 + rand() * 0.3, seed: c * 10 + q });
      dry.add(sg, when, 0.42, rand() * 0.6 - 0.3);
      send.add(sg, when, 0.3);
      // Now and then a quiet fifth below, like a hand resting on the keys.
      if (rand() < 0.3) { const lo = feltPiano(midi(m - 7), 5, { vel: 0.35, seed: c * 10 + q + 50 }); dry.add(lo, when + 0.06, 0.3); send.add(lo, when + 0.06, 0.2); }
    }
    // A faint shimmer over every other chord, high but dark, flickering slowly.
    if (c % 2 === 1) {
      const sg = shimmer(midi(voicing[3] + 24), 2 * bar + 3, { seed: c });
      dry.add(sg, t0 + 1.5, 0.012, c % 4 === 1 ? 0.5 : -0.5);
      send.add(sg, t0 + 1.5, 0.03);
    }
  });
  const wet = reverb(send, { room: 0.93, damp: 0.5 });
  wet.mixInto(dry, 1.3);
  return { name: 'asmr-felt-glass', L, bus: dry };
}

/**
 * Regular mode: "Protractor". 100 BPM straight eighths (no swing, unlike the other two), 24 bars of 4/4 (57.6 s). D minor
 * into F major and back: a marimba arpeggio that never stops, like working a puzzle out; a marimba motif in sections 1 and 3 and a
 * whistled tune in section 2; a syncopated bass; kick, rim clicks on 2 and 4 and soft sixteenth hats.
 */
function protractor() {
  const bpm = 100, beat = 60 / bpm, bar = 4 * beat, bars = 24, L = bars * bar;
  const total = L + TAIL;
  const dry = new Bus(total, L), send = new Bus(total, L), echo = new Bus(total, L);
  const at = (barNo, b) => barNo * bar + b * beat;
  const Dm = [[57, 62, 65, 69], 38], Bb = [[58, 62, 65, 70], 34], F = [[57, 60, 65, 69], 41], C = [[55, 60, 64, 67], 36];
  const Am = [[57, 60, 64, 69], 33], Gm = [[55, 58, 62, 67], 43];
  const sections = [
    [Dm, Bb, F, C, Dm, Bb, C, C],   // the puzzle
    [Bb, C, Am, Dm, Gm, C, F, F],   // it opens up (the whistle)
    [Dm, Bb, F, C, Gm, Bb, C, C],   // back to work, home to D minor
  ];
  const SCALE = [74, 77, 79, 81, 84, 86]; // D minor pentatonic: D5 F5 G5 A5 C6 D6
  const ARP = [0, 1, 2, 3, 2, 1, 2, 3];
  sections.forEach((chords, sec) => {
    const rand = rng(1000 + sec * 13);
    const motif = Array.from({ length: 8 }, (_, e) => (rand() < (e % 2 ? 0.35 : 0.8) ? Math.floor(rand() * SCALE.length) : -1));
    chords.forEach(([voicing, root], k) => {
      const i = sec * 8 + k;
      const pcs = voicing.map((m) => m % 12);
      // Marimba arpeggio on every eighth, up and down the chord, the upbeats softer.
      ARP.forEach((q, e) => {
        const sg = marimba(midi(voicing[q] + (e === 3 ? 12 : 0)), 0.9, { tau: 0.35 });
        dry.add(sg, at(i, e / 2), e % 2 ? 0.11 : 0.16, e % 2 ? 0.35 : -0.35);
        send.add(sg, at(i, e / 2), 0.05);
      });
      // A low sustained chord under it, very soft, so the harmony carries between the notes.
      voicing.slice(0, 3).forEach((m, v) => {
        const sg = pad(midi(m), bar + 1.2, { attack: 0.25, release: 0.9, cutoff: 900, seed: 300 + i * 3 + v });
        dry.add(sg, at(i, 0), 0.3, (v - 1) * 0.5);
        send.add(sg, at(i, 0), 0.08);
      });
      // Bass: syncopated, the root on 1, a push on the and of 2, the fifth on 3, an octave pickup at the end, up an octave for phones.
      [[0, 0, 1.2, 0.36], [1.5, 0, 0.45, 0.28], [2, 7, 0.9, 0.3], [3.5, 12, 0.4, 0.24]].forEach(([b, iv, d, g]) =>
        dry.add(bass(midi(root + 12 + iv), d * beat), at(i, b), g));
      // Drums: kick on 1 and the and of 2 (and 3 in the middle section), rim clicks on 2 and 4, sixteenth hats with a lilt.
      for (const kb of [0, 1.5, ...(sec === 1 ? [3] : [])]) dry.add(kick(), at(i, kb), 0.24);
      for (const sb of [1, 3]) { const sg = noiseHit('snap', 8000 + i * 10 + sb); dry.add(sg, at(i, sb), 0.2, -0.1); send.add(sg, at(i, sb), 0.05); }
      for (let h = 0; h < 16; h++) dry.add(noiseHit('shaker', 9000 + i * 100 + h), at(i, h / 4), h % 4 === 2 ? 0.07 : h % 2 ? 0.03 : 0.045, 0.45);
      if (sec === 1) {
        // The whistle: long notes, one or two a bar, from the chord's own tones, with an echo.
        const tones = SCALE.filter((m) => pcs.includes(m % 12));
        const pick = tones.length ? tones : SCALE;
        const a = pick[(k * 2) % pick.length], b = pick[(k * 2 + 1) % pick.length];
        const long = k % 4 === 3;
        const w1 = whistle(midi(a), long ? 3.4 * beat : 1.8 * beat, { seed: i });
        dry.add(w1, at(i, 0.5), 0.2, 0.15); echo.add(w1, at(i, 0.5), 0.1); send.add(w1, at(i, 0.5), 0.08);
        if (!long) { const w2 = whistle(midi(b), 1.4 * beat, { seed: i + 50 }); dry.add(w2, at(i, 2.5), 0.17, 0.15); echo.add(w2, at(i, 2.5), 0.09); send.add(w2, at(i, 2.5), 0.07); }
        return;
      }
      // Marimba motif an octave over the arpeggio, nudged onto chord tones on the beats, a little different on odd bars.
      motif.forEach((idx, e) => {
        if (idx < 0) return;
        let j = Math.min(SCALE.length - 1, idx + (k % 2 && e > 4 ? 1 : 0));
        if (e % 2 === 0 && !pcs.includes(SCALE[j] % 12)) {
          const near = SCALE.map((m, q) => (pcs.includes(m % 12) ? q : -1)).filter((q) => q >= 0);
          if (near.length) j = near.reduce((a, q) => (Math.abs(q - j) < Math.abs(a - j) ? q : a), near[0]);
        }
        const sg = marimba(midi(SCALE[j]), 1.1, { tau: 0.5 });
        dry.add(sg, at(i, e / 2), 0.3, 0.1);
        send.add(sg, at(i, e / 2), 0.12);
        echo.add(sg, at(i, e / 2), 0.06);
      });
    });
  });
  const wetE = pingPong(echo, 3 * beat / 4, 0.35, 3000);
  wetE.mixInto(dry, 0.7);
  const wet = reverb(send, { room: 0.76, damp: 0.45 });
  wet.mixInto(dry, 1);
  return { name: 'protractor', L, bus: dry };
}

/**
 * ASMR mode: "Paper Lanterns". 64 BPM, 16 bars of 4/4 (60 s), from the ASMR bounce chimes' notes (C D E G A) over soft chords.
 * A kalimba plays a lilting 3+3+2 figure, sparse and loosely timed, into a slow echo; warm low pads cross-fade chord to chord over a
 * held root; faint rain underneath and now and then a single water drop. No beat, nothing bright, so the game's chimes ring on top.
 */
function paperLanterns() {
  const bpm = 64, beat = 60 / bpm, bar = 4 * beat, bars = 16, L = bars * bar;
  const total = L + TAIL + 2;
  const dry = new Bus(total, L), send = new Bus(total, L), echo = new Bus(total, L);
  const PENTA = new Set([0, 2, 4, 7, 9]);
  const chords = [
    [[45, 57, 60, 64, 67], 33], // Am7
    [[41, 57, 60, 64, 69], 29], // Fmaj7
    [[48, 55, 60, 62, 64], 36], // Cadd9
    [[43, 55, 59, 62, 64], 31], // G6
    [[45, 57, 60, 64, 69], 33], // Am
    [[40, 55, 59, 62, 67], 28], // Em7
    [[41, 53, 57, 60, 64], 29], // Fmaj7
    [[43, 50, 55, 60, 62], 31], // Gsus
  ];
  const rand = rng(6464);
  chords.forEach(([voicing, root], c) => {
    const t0 = c * 2 * bar - 2; // each pad swells in under the one before
    voicing.slice(1).forEach((m, k) => {
      const sg = pad(midi(m), 2 * bar + 4.5, { attack: 2.6, release: 3.2, cutoff: 850, seed: 500 + c * 5 + k });
      dry.add(sg, t0, 0.34, (k - 1.5) * 0.5);
      send.add(sg, t0, 0.24, (k - 1.5) * 0.5);
    });
    dry.add(sustain(midi(root + 12), 2 * bar + 4, { attack: 2.6, release: 3, breathe: 0.15 }), t0, 0.07);
    // Kalimba: for each of the chord's two bars, the 3+3+2 figure (eighths 0, 3, 6) from its pentatonic tones, rising, with
    // passing notes now and then; each note a touch early or late.
    const tones = [...new Set(voicing.slice(1).flatMap((m) => [m + 12, m + 24]))].filter((m) => PENTA.has(m % 12) && m >= 67 && m <= 88).sort((a, b) => a - b);
    for (let half = 0; half < 2; half++) {
      const barStart = (c * 2 + half) * bar;
      const slots = [0, 3, 6, ...(rand() < 0.5 ? [7] : []), ...(rand() < 0.35 ? [4] : [])];
      let q = Math.floor(rand() * 2);
      for (const e of slots.sort((a, b) => a - b)) {
        if (rand() < 0.15) continue; // a breath
        const m = tones[Math.min(tones.length - 1, q)];
        q = (q + 1 + Math.floor(rand() * 2)) % tones.length;
        const when = barStart + (e / 2) * beat + (rand() - 0.5) * 0.04;
        const sg = kalimba(midi(m), 3, { tau: 1.1 + rand() * 0.5 });
        const g = e === 0 ? 0.3 : 0.22;
        dry.add(sg, when, g, rand() * 0.8 - 0.4);
        echo.add(sg, when, g * 0.5);
        send.add(sg, when, g * 0.5);
      }
    }
    // A water drop or two per chord, at random spots, high and very soft.
    const drops = 1 + Math.floor(rand() * 2);
    for (let d = 0; d < drops; d++) {
      const when = c * 2 * bar + rand() * 2 * bar;
      const sg = drop(900 + rand() * 900);
      dry.add(sg, when, 0.05, rand() * 1.6 - 0.8);
      send.add(sg, when, 0.06);
    }
  });
  // Rain: soft filtered noise through the whole loop, its level drifting very slowly (one swell per loop, so it meets at the seam).
  const nL = Math.round(L * SR), rain = new Float32Array(nL), rr = rng(77);
  let prev = 0;
  for (let i = 0; i < nL; i++) { const w = rr() * 2 - 1; rain[i] = w - 0.7 * prev; prev = w; }
  lowpass(lowpass(rain, 3200), 4200);
  for (let i = 0; i < nL; i++) rain[i] *= 0.8 + 0.2 * Math.sin((2 * Math.PI * i) / nL);
  dry.add(rain, 0, 0.022, -0.2);
  dry.add(rain.slice().reverse(), 0, 0.022, 0.2); // a different stretch of it on the other side, so it's wide
  const wetE = pingPong(echo, 3 * beat / 2, 0.5, 2200);
  wetE.mixInto(dry, 0.75);
  wetE.mixInto(send, 0.4);
  const wet = reverb(send, { room: 0.92, damp: 0.45 });
  wet.mixInto(dry, 1.25);
  return { name: 'asmr-paper-lanterns', L, bus: dry };
}

/**
 * Regular mode: "Set Square". A lilting 6/8 (the other regular tracks are all 4/4), dotted quarter at 72 BPM, 32 bars (about 53 s),
 * G major. An oom-pah-pah: a plucked bass on each beat and strummed chords on the off-eighths; a celesta tune that changes each
 * section, a whistled counter-tune in the last one, soft snaps on the second beat and a shaker on every eighth.
 */
function setSquare() {
  const e8 = 60 / (72 * 3), bar = 6 * e8, bars = 32, L = bars * bar;
  const total = L + TAIL;
  const dry = new Bus(total, L), send = new Bus(total, L), echo = new Bus(total, L);
  const at = (barNo, e) => barNo * bar + e * e8;
  const G = [[55, 59, 62, 67], 43], Em = [[55, 59, 64, 67], 40], C = [[55, 60, 64, 67], 36], D = [[54, 57, 62, 66], 38];
  const Bm = [[54, 59, 62, 66], 35], Am = [[57, 60, 64, 69], 33];
  const sections = [
    [G, Em, C, D, G, Em, Am, D],   // the tune
    [C, D, Bm, Em, Am, D, G, G],   // it lifts
    [G, Em, C, D, G, Bm, C, D],    // the tune again, a little different
    [Em, C, G, D, Am, C, D, G],    // the whistle answers, home
  ];
  const SCALE = [67, 69, 71, 74, 76, 79, 81]; // G major pentatonic: G4 A4 B4 D5 E5 G5 A5
  sections.forEach((chords, sec) => {
    const rand = rng(6800 + sec * 17);
    // The tune: a long-short lilt (eighths 0, 2, 3, 5 mostly), one motif per section with small changes on odd bars.
    const motif = [0, 1, 2, 3, 4, 5].map((e) => (rand() < ([0, 3].includes(e) ? 0.9 : e === 2 || e === 5 ? 0.6 : 0.2) ? Math.floor(rand() * SCALE.length) : -1));
    chords.forEach(([voicing, root], k) => {
      const i = sec * 8 + k;
      const pcs = voicing.map((m) => m % 12);
      // Oom: plucked bass on beats 1 and 2 (eighths 0 and 3), root then fifth, up an octave for phones.
      dry.add(pluck(midi(root + 12), 0.9, { bright: 0.25, decay: 0.993, seed: 3000 + i }), at(i, 0), 0.75);
      dry.add(pluck(midi(root + 19), 0.8, { bright: 0.25, decay: 0.993, seed: 3100 + i }), at(i, 3), 0.62);
      // A soft chord bed under it all, so the lilt has some warmth.
      voicing.slice(0, 3).forEach((m, v) => {
        const sg = pad(midi(m), bar + 1.2, { attack: 0.3, release: 0.9, cutoff: 900, seed: 3500 + i * 3 + v });
        dry.add(sg, at(i, 0), 0.3, (v - 1) * 0.5);
        send.add(sg, at(i, 0), 0.08);
      });
      // Pah-pah: strummed chords on the off-eighths, each string a few ms after the last.
      for (const e of [1, 2, 4, 5]) voicing.forEach((m, v) => {
        const sg = pluck(midi(m), 0.6, { bright: 0.4, decay: 0.994, seed: 3300 + i * 40 + e * 5 + v });
        dry.add(sg, at(i, e) + v * 0.008, e === 1 || e === 4 ? 0.24 : 0.17, (v - 1.5) * 0.3);
        send.add(sg, at(i, e) + v * 0.008, 0.04);
      });
      // Drums: a soft kick on beat 1, a snap on beat 2, a shaker on every eighth (the beats a touch louder).
      dry.add(kick(), at(i, 0), 0.22);
      { const sg = noiseHit('snap', 9500 + i); dry.add(sg, at(i, 3), 0.18, 0.1); send.add(sg, at(i, 3), 0.05); }
      for (let e = 0; e < 6; e++) dry.add(noiseHit('shaker', 9700 + i * 10 + e), at(i, e), e % 3 === 0 ? 0.07 : 0.04, 0.4);
      // Celesta tune, nudged onto chord tones on the beats; the last section leaves room for the whistle.
      motif.forEach((idx, e) => {
        if (idx < 0 || (sec === 3 && e > 2)) return;
        let j = Math.min(SCALE.length - 1, idx + (k % 2 && e >= 3 ? 1 : 0));
        if ((e === 0 || e === 3) && !pcs.includes(SCALE[j] % 12)) {
          const near = SCALE.map((m, q) => (pcs.includes(m % 12) ? q : -1)).filter((q) => q >= 0);
          if (near.length) j = near.reduce((a, q) => (Math.abs(q - j) < Math.abs(a - j) ? q : a), near[0]);
        }
        const sg = celesta(midi(SCALE[j]), 1.4, { tau: 0.7 });
        dry.add(sg, at(i, e), 0.22, 0.15);
        send.add(sg, at(i, e), 0.1);
        echo.add(sg, at(i, e), 0.06);
      });
      // Section 4: a whistled counter-tune, one long note a bar from the chord, answering the celesta.
      if (sec === 3) {
        const tones = SCALE.filter((m) => pcs.includes(m % 12));
        const w = whistle(midi((tones[k % tones.length] ?? SCALE[2]) + 12), 2.6 * e8, { seed: 7000 + i });
        dry.add(w, at(i, 3), 0.16, -0.2); echo.add(w, at(i, 3), 0.07); send.add(w, at(i, 3), 0.07);
      }
    });
  });
  const wetE = pingPong(echo, 3 * e8, 0.3, 3200);
  wetE.mixInto(dry, 0.7);
  const wet = reverb(send, { room: 0.78, damp: 0.42 });
  wet.mixInto(dry, 1);
  return { name: 'set-square', L, bus: dry };
}

/**
 * ASMR mode: "Tidewater". 56 BPM, 16 bars of 4/4 (about 69 s), no beat. Waves roll in and draw back every 8.6 s (eight to a loop, so
 * they meet at the seam); long glass-harmonica tones cross-fade from chord to chord over a low bowed drone; a harp rolls gently up
 * the chord's pentatonic notes (the ASMR bounce chimes' notes) at each change, and now and then a single high note.
 */
function tidewater() {
  const bpm = 56, beat = 60 / bpm, bar = 4 * beat, bars = 16, L = bars * bar;
  const total = L + TAIL + 2;
  const dry = new Bus(total, L), send = new Bus(total, L);
  const PENTA = new Set([0, 2, 4, 7, 9]);
  const chords = [
    [[57, 64, 67, 72], 33], // Am7
    [[57, 64, 69, 72], 29], // Fmaj7
    [[55, 64, 67, 72], 36], // C
    [[55, 62, 67, 71], 31], // G (B only in the glass, never the harp)
    [[57, 64, 67, 74], 33], // Am(add 9)
    [[55, 62, 67, 71], 28], // Em7
    [[57, 64, 69, 72], 29], // Fmaj7
    [[55, 62, 67, 74], 31], // Gsus
  ];
  const rand = rng(5656);
  chords.forEach(([voicing, root], c) => {
    const t0 = c * 2 * bar - 2.2;
    // Glass harmonica: the chord's upper three notes, held across the two bars and swelling under the next.
    voicing.slice(1).forEach((m, k) => {
      const sg = glassHarp(midi(m), 2 * bar + 5, { attack: 2.4, release: 3.2, seed: 700 + c * 5 + k });
      dry.add(sg, t0, 0.11, (k - 1) * 0.55);
      send.add(sg, t0, 0.14, (k - 1) * 0.55);
    });
    // A low bowed drone on the root and fifth.
    dry.add(bowed(midi(root + 12), 2 * bar + 4.5, { seed: 800 + c }), t0, 0.1, -0.15);
    dry.add(bowed(midi(root + 19), 2 * bar + 4.5, { seed: 820 + c }), t0 + 0.6, 0.05, 0.2);
    // Harp: a gentle roll up the chord's pentatonic notes at the change, loosely timed.
    const tones = [...new Set(voicing.flatMap((m) => [m, m + 12]))].filter((m) => PENTA.has(m % 12) && m >= 57 && m <= 86).sort((a, b) => a - b);
    const start = c * 2 * bar + 0.15;
    tones.slice(0, 4 + Math.floor(rand() * 2)).forEach((m, q) => {
      const sg = pluck(midi(m), 3.2, { bright: 0.3, decay: 0.9985, seed: 4000 + c * 10 + q, attack: 0.003 });
      const when = start + q * 0.17 + rand() * 0.03;
      dry.add(sg, when, 0.2, -0.3 + q * 0.15);
      send.add(sg, when, 0.16);
    });
    // Now and then one high harp note in the second bar.
    if (rand() < 0.7) {
      const m = tones[tones.length - 1 - Math.floor(rand() * 2)] + 12;
      const sg = pluck(midi(m), 3.5, { bright: 0.35, decay: 0.9985, seed: 4500 + c, attack: 0.003 });
      const when = c * 2 * bar + bar + (1 + rand() * 2) * beat;
      dry.add(sg, when, 0.12, rand() * 0.8 - 0.4);
      send.add(sg, when, 0.14);
    }
  });
  // Waves: soft noise that swells in and draws back, eight times a loop, a little brighter at each crest, slightly different each side.
  const nL = Math.round(L * SR);
  for (const [side, seed, lag] of [[-0.35, 91, 0], [0.35, 92, 0.18]]) {
    const wave = new Float32Array(nL), r = rng(seed);
    let lo = 0, hi = 0;
    for (let i = 0; i < nL; i++) {
      const ph = ((i / nL) * 8 + lag) % 1;
      const swell = Math.pow(Math.sin(Math.PI * ph), 2) * (0.6 + 0.4 * Math.sin(Math.PI * ph));
      const w = r() * 2 - 1;
      lo += (0.02 + 0.06 * swell) * (w - lo);
      hi += 0.3 * (w - hi);
      wave[i] = (lo * 2.2 + (w - hi) * 0.25 * swell) * (0.15 + swell);
    }
    dry.add(wave, 0, 0.05, side);
    send.add(wave, 0, 0.02, side);
  }
  const wet = reverb(send, { room: 0.93, damp: 0.5 });
  wet.mixInto(dry, 1.25);
  return { name: 'asmr-tidewater', L, bus: dry };
}

// ---------------------------------------------------------------- output

/** A gentle low cut (one-pole high-pass) on a bus, in place: rumble no phone speaker plays, which only eats headroom. */
function lowCut(bus, cutoff) {
  const a = Math.exp((-2 * Math.PI * cutoff) / SR);
  for (const ch of [bus.l, bus.r]) {
    let x1 = 0, y1 = 0;
    for (let i = 0; i < ch.length; i++) { const x = ch[i]; const y = a * (y1 + x - x1); x1 = x; y1 = y; ch[i] = y; }
  }
}

/** The loop as it sounds repeating forever: the render with everything past the end added back onto the start. */
function wrap(bus, L) {
  const nL = Math.round(L * SR), l = new Float32Array(nL), r = new Float32Array(nL);
  for (let i = 0; i < bus.n; i++) { l[i % nL] += bus.l[i]; r[i % nL] += bus.r[i]; }
  return { l, r, n: nL };
}

/** A 16-bit PCM WAV at `rate` (resampled linearly from SR), `channels` 1 or 2. */
function wav(l, r, gain, rate, channels) {
  const step = SR / rate, frames = Math.floor(l.length / step);
  const buf = Buffer.alloc(44 + frames * channels * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + frames * channels * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * channels * 2, 28); buf.writeUInt16LE(channels * 2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(frames * channels * 2, 40);
  const sample = (ch, x) => { const i = Math.floor(x), f = x - i, a = ch[i] ?? 0, b = ch[i + 1] ?? ch[0]; return a + (b - a) * f; };
  for (let k = 0; k < frames; k++) {
    const x = k * step;
    const vals = channels === 2 ? [sample(l, x), sample(r, x)] : [(sample(l, x) + sample(r, x)) / 2];
    vals.forEach((v, c) => buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * gain * 32767))), 44 + (k * channels + c) * 2));
  }
  return buf;
}

const only = process.argv[2];
for (const [file, make] of [['graph-paper', graphPaper], ['asmr-neon-drift', neonDrift], ['sketchbook', sketchbook], ['asmr-felt-glass', feltGlass], ['protractor', protractor], ['asmr-paper-lanterns', paperLanterns], ['set-square', setSquare], ['asmr-tidewater', tidewater]]) {
  if (only && !file.includes(only)) continue; // skipped before rendering, so one track takes seconds
  const { name, L, bus } = make();
  lowCut(bus, 70);
  const looped = wrap(bus, L);
  // Level: by average loudness (RMS), so the calm ASMR track sits a little under the regular one, never above -1 dBFS peak.
  // (The game sets the music's overall volume itself.)
  let peak = 0, sum = 0;
  for (let i = 0; i < looped.n; i++) { peak = Math.max(peak, Math.abs(looped.l[i]), Math.abs(looped.r[i])); sum += looped.l[i] ** 2 + looped.r[i] ** 2; }
  const target = name === 'asmr-felt-glass' ? -21 : name.startsWith('asmr') ? -20 : -18; // dBFS RMS: Felt Glass is the quietest
  const gain = Math.min(0.89 / peak, 10 ** (target / 20) / Math.sqrt(sum / (2 * looped.n)));
  const rms = Math.sqrt(sum / (2 * looped.n)) * gain;
  // Seam check: how big the step is from the loop's last sample to its first, against a typical sample-to-sample step.
  let typical = 0;
  for (let i = 1; i < looped.n; i++) typical += Math.abs(looped.l[i] - looped.l[i - 1]);
  typical /= looped.n - 1;
  const seam = Math.abs(looped.l[0] - looped.l[looped.n - 1]);
  // Phones: the wrapped loop, stereo at 32 kHz (plenty for soft music, and half the size of CD quality).
  fs.mkdirSync(path.join(MUSIC, 'loops'), { recursive: true });
  fs.writeFileSync(path.join(MUSIC, 'loops', `${name}.wav`), wav(looped.l, looped.r, gain, 32000, 2));
  // Web: one pass plus its tail, as MP3 (via a temporary WAV).
  const tmp = path.join(MUSIC, `.${name}.tmp.wav`);
  fs.writeFileSync(tmp, wav(bus.l, bus.r, gain, SR, 2));
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', tmp, '-codec:a', 'libmp3lame', '-q:a', '4', path.join(MUSIC, `${name}.mp3`)]);
  fs.unlinkSync(tmp);
  fs.writeFileSync(path.join(MUSIC, `${name}.json`), JSON.stringify({ loop: Number(L.toFixed(6)) }) + '\n');
  console.log(`${name}: loop ${L.toFixed(2)} s, peak ${(20 * Math.log10(peak * gain)).toFixed(1)} dBFS, rms ${(20 * Math.log10(rms)).toFixed(1)} dBFS, seam step ${(seam / typical).toFixed(2)}× a typical step`);
}
