// Synthesises the game's sound effects into assets/sounds/*.wav (mono, 16-bit, 44.1 kHz).
// Deterministic: no randomness, so re-running it reproduces the committed files byte for byte.
// Run with: node scripts/make-sounds.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 44100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');

/** Sum of decaying sine partials: [frequency Hz, amplitude, decay time constant s]. */
function partials(seconds, list, { attack = 0.003, start = 0 } = {}) {
  const n = Math.round(seconds * RATE), out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE - start;
    if (t < 0) continue;
    const env = Math.min(1, t / attack);
    for (const [f, a, tau] of list) out[i] += env * a * Math.exp(-t / tau) * Math.sin(2 * Math.PI * f * t);
  }
  return out;
}

function mix(...tracks) {
  const n = Math.max(...tracks.map((t) => t.length)), out = new Float64Array(n);
  for (const t of tracks) for (let i = 0; i < t.length; i++) out[i] += t[i];
  return out;
}

/** A low thump whose pitch falls, for a dead hit. */
function thud(seconds, f0, f1, tau) {
  const n = Math.round(seconds * RATE), out = new Float64Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const f = f1 + (f0 - f1) * Math.exp(-t / 0.04);
    phase += (2 * Math.PI * f) / RATE;
    out[i] = Math.min(1, t / 0.002) * Math.exp(-t / tau) * Math.sin(phase);
  }
  return out;
}

/** Air rushing past: low-passed noise that swells and fades. Seeded, so the file is the same every run. */
function whoosh(seconds, peakAt, cutoff) {
  const n = Math.round(seconds * RATE), out = new Float64Array(n);
  let seed = 12345, lp = 0;
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / RATE); // one-pole low-pass
  for (let i = 0; i < n; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const white = seed / 2147483648 - 1;
    lp += a * (white - lp);
    const t = i / RATE;
    const env = t < peakAt ? t / peakAt : Math.exp(-(t - peakAt) / (seconds * 0.25));
    out[i] = lp * env;
  }
  return out;
}

/** A crack: seeded noise with the low end taken out (a differentiator), dying fast. */
function crack(seconds, tau) {
  const n = Math.round(seconds * RATE), out = new Float64Array(n);
  let seed = 987654, prev = 0;
  for (let i = 0; i < n; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const white = seed / 2147483648 - 1;
    out[i] = (white - prev) * Math.exp(-(i / RATE) / tau);
    prev = white;
  }
  return out;
}

/** A zap: a tone whose pitch falls from f0 to f1, like air going out of something. */
function zap(seconds, f0, f1, tau, fall) {
  const n = Math.round(seconds * RATE), out = new Float64Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    phase += (2 * Math.PI * (f1 + (f0 - f1) * Math.exp(-t / fall))) / RATE;
    out[i] = Math.min(1, t / 0.002) * Math.exp(-t / tau) * Math.sin(phase);
  }
  return out;
}

/**
 * Shards landing: `count` short glassy or metallic pings scattered over `spread` seconds, thick at first and thinning out, each
 * quieter than the last. Seeded, so the file is the same every run.
 */
function tinkles(seconds, count, spread, seed) {
  const n = Math.round(seconds * RATE), out = new Float64Array(n);
  let s = seed;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let k = 0; k < count; k++) {
    const at = 0.04 + spread * (k / count) ** 1.7 + rand() * 0.03;
    const f = k % 4 === 3 ? 1100 + rand() * 900 : 2600 + rand() * 4200; // mostly glassy, every fourth a lower metal clink
    const amp = 0.55 * (1 - k / count) ** 0.8 + 0.08;
    const tau = 0.025 + rand() * 0.05;
    const start = Math.round(at * RATE);
    for (let i = start; i < n; i++) {
      const t = (i - start) / RATE;
      if (t > tau * 8) break;
      out[i] += amp * Math.min(1, t / 0.0008) * Math.exp(-t / tau) * (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * f * 2.76 * t));
    }
  }
  return out;
}

/**
 * A soft pad: each note as a pair of slightly detuned sines (a gentle chorus), swelling in over `attack`, breathing with a slow
 * tremolo, and dying away over the last `release` seconds. `notes` are [frequency, amplitude].
 */
function pad(seconds, notes, { start = 0, attack = 0.8, release = 1.5, tremolo = 3.5 } = {}) {
  const n = Math.round(seconds * RATE), out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE - start;
    if (t < 0) continue;
    const left = seconds - start - t;
    const env = Math.min(1, t / attack) * Math.min(1, left / release) * (0.85 + 0.15 * Math.sin(2 * Math.PI * tremolo * t));
    let v = 0;
    for (const [f, a] of notes) v += a * (Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 1.004 * t + 1.3)) * 0.5;
    out[i] += env * v;
  }
  return out;
}

/** A harp run: plucked notes one after another, `gap` seconds apart, starting at `start`. */
function glissando(seconds, freqs, gap, start = 0) {
  return mix(...freqs.map((f, k) => partials(seconds, [[f, 0.6, 0.7], [f * 2, 0.18, 0.4], [f * 3, 0.06, 0.25]], { attack: 0.004, start: start + k * gap })));
}

/** Sparkles: high, soft pentatonic pings scattered from `from` to `to` seconds. Seeded. */
function sparkles(seconds, count, from, to, seed) {
  let s = seed;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const notes = [2093, 2349.3, 2637, 3136, 3520, 4186];
  return mix(...Array.from({ length: count }, (_, k) => {
    const at = from + (to - from) * (k / count) + rand() * 0.08;
    return partials(seconds, [[notes[Math.floor(rand() * notes.length)], 0.14 + rand() * 0.1, 0.18]], { attack: 0.003, start: at });
  }));
}

function scale(track, k) {
  return track.map((v) => v * k);
}

function wav(samples, peak = 0.8) {
  const max = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40);
  // Fade the last 5 ms so no sound ends on a click.
  const fade = Math.round(0.005 * RATE);
  samples.forEach((v, i) => {
    const tail = Math.min(1, (samples.length - 1 - i) / fade);
    buf.writeInt16LE(Math.round((v / max) * peak * tail * 32767), 44 + i * 2);
  });
  return buf;
}

const sounds = {
  // The launcher firing: a short thunk with a whoosh of air behind it.
  launch: mix(thud(0.3, 190, 85, 0.04), scale(whoosh(0.3, 0.05, 1800), 0.9)),
  // Ball off the floor or a board edge: a dull, woody tok (bars ring; walls don't).
  wall: partials(0.12, [[520, 1, 0.018], [1240, 0.35, 0.01], [2010, 0.15, 0.006]], { attack: 0.001 }),
  // Steel ball on a bar: a short bright tink.
  bounce: partials(0.16, [[1420, 1, 0.035], [3380, 0.45, 0.02], [5150, 0.2, 0.012]]),
  // Ball against the glass: higher, glassy, rings a little longer.
  glass: partials(0.32, [[2640, 1, 0.08], [4170, 0.5, 0.06], [6930, 0.25, 0.03]]),
  // In the glass: a rising two-note chime (A5 then E6).
  land: mix(
    partials(0.75, [[880, 1, 0.22], [1760, 0.3, 0.12]]),
    partials(0.75, [[1318.5, 1, 0.28], [2637, 0.3, 0.14]], { start: 0.09 }),
  ),
  // A star on the win card: a bright, short pluck (played three times, each a step higher).
  star: mix(
    partials(0.5, [[1320, 0.5, 0.18], [2640, 0.28, 0.12], [3960, 0.14, 0.08]], { attack: 0.002 }),
    scale(thud(0.12, 400, 220, 0.04), 0.35),
  ),
  // The glass bursting into confetti: a soft pop, a shimmer rising out of it, and a little air.
  burst: mix(
    scale(thud(0.25, 260, 90, 0.07), 0.8),
    scale(zap(0.55, 700, 2600, 0.22, 0.14), 0.4),
    partials(0.6, [[2100, 0.2, 0.09], [3150, 0.16, 0.08], [4200, 0.12, 0.07]], { start: 0.06 }),
    scale(whoosh(0.4, 0.12, 3000), 0.45),
  ),
  // A portal: a soft whoosh in, a rising shimmer out, glassy overtones.
  warp: mix(
    scale(zap(0.5, 220, 1100, 0.25, 0.16), 0.55),
    scale(zap(0.4, 1500, 420, 0.14, 0.09), 0.35),
    partials(0.5, [[1800, 0.22, 0.07], [2700, 0.16, 0.06], [3900, 0.1, 0.05]], { start: 0.05 }),
    scale(whoosh(0.35, 0.15, 2200), 0.5),
  ),
  // A spring pad: a springy rising boing, a bright zap over it, sparkling overtones and a firm thump under.
  boing: mix(
    scale(zap(0.42, 260, 1500, 0.2, 0.09), 0.6),
    scale(zap(0.3, 520, 3000, 0.12, 0.07), 0.3),
    partials(0.45, [[2400, 0.3, 0.05], [3600, 0.22, 0.045], [5200, 0.16, 0.04]], { start: 0.03 }),
    partials(0.35, [[3100, 0.25, 0.04], [4700, 0.18, 0.035]], { start: 0.1 }),
    scale(thud(0.2, 190, 80, 0.06), 0.8),
  ),
  // ASMR mode (game/asmr.ts): a soft bell (C5) for every bounce, pitched up a pentatonic scale as a shot goes on. A gentle attack
  // and a long, quiet ring, so a fast chain blurs into a melody rather than a clatter.
  chime: partials(1.4, [[523.25, 1, 0.55], [1046.5, 0.22, 0.32], [1569.75, 0.07, 0.2], [2093, 0.04, 0.12]], { attack: 0.008 }),
  // The ball shattering on a hazard (slow motion on the board): a sharp crack and a deep boom, a rush of air, then shards
  // tinkling down and skidding to rest, thinning out over almost two seconds, with a soft falling shimmer underneath.
  shatter: mix(
    scale(crack(0.16, 0.035), 0.75),
    scale(thud(1.2, 120, 34, 0.32), 1.0),
    scale(whoosh(0.7, 0.04, 2600), 0.5),
    scale(zap(1.6, 2400, 260, 0.6, 0.5), 0.12),
    tinkles(2.2, 30, 1.7, 4242),
  ),
  // ASMR mode's win, timed to the light bloom (game/bloom.ts): a harp run up the bounce chimes' pentatonic scale as the light races
  // the winning path, then a warm, chorused chord (C, E, G, A, D) swelling in under high sparkles, with a low C underneath.
  bloom: mix(
    glissando(5.6, [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5], 0.1),
    scale(pad(5.6, [[261.63, 0.5], [329.63, 0.4], [392, 0.35], [440, 0.22], [587.33, 0.2]], { start: 1.1, attack: 0.9, release: 2.2 }), 0.7),
    scale(pad(5.6, [[65.41, 0.6], [130.81, 0.3]], { start: 1.0, attack: 1.2, release: 2.4, tremolo: 0.8 }), 0.6),
    sparkles(5.6, 18, 1.6, 4.4, 777),
    partials(5.6, [[1046.5, 0.35, 1.2], [1568, 0.2, 0.9], [2093, 0.12, 0.7]], { attack: 0.01, start: 4.05 }),
  ),
};

mkdirSync(OUT, { recursive: true });
for (const [name, samples] of Object.entries(sounds)) {
  const file = join(OUT, `${name}.wav`);
  writeFileSync(file, wav(samples));
  console.log(`${file} (${(samples.length / RATE).toFixed(2)} s)`);
}
