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
  // Steel ball on a bar: a short bright tink.
  bounce: partials(0.16, [[1420, 1, 0.035], [3380, 0.45, 0.02], [5150, 0.2, 0.012]]),
  // Ball against the glass: higher, glassy, rings a little longer.
  glass: partials(0.32, [[2640, 1, 0.08], [4170, 0.5, 0.06], [6930, 0.25, 0.03]]),
  // In the glass: a rising two-note chime (A5 then E6).
  land: mix(
    partials(0.75, [[880, 1, 0.22], [1760, 0.3, 0.12]]),
    partials(0.75, [[1318.5, 1, 0.28], [2637, 0.3, 0.14]], { start: 0.09 }),
  ),
  // A dead surface: a soft low thump.
  dead: thud(0.22, 150, 70, 0.07),
};

mkdirSync(OUT, { recursive: true });
for (const [name, samples] of Object.entries(sounds)) {
  const file = join(OUT, `${name}.wav`);
  writeFileSync(file, wav(samples));
  console.log(`${file} (${(samples.length / RATE).toFixed(2)} s)`);
}
