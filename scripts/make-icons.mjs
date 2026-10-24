// Draws the app icon: graph paper, a bar, the ball's path off it into the glass, and the ball.
// Writes assets/icon.png (1024, for the iOS/Android builds) and public/icons/icon-{180,192,512}.png
// (web: home-screen icon and manifest), plus assets/splash-icon.png: the same picture with rounded corners on
// a transparent background, shown on the launch screen and as the first frame of the intro (components/splash). Opaque, as the App Store requires. Deterministic: no randomness.
// Run with: node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
// Colour tokens from reference/prototype.html (light mode).
const C = { paper: hex('#e9eee3'), grid: hex('#cfdacb'), ink: hex('#2c3133'), pencil: hex('#2d5c9e'), red: hex('#b5352a'), steel: hex('#a7aeb3') };

// Shapes in a 0..1 unit square, painted in order. Each returns coverage-free inside tests;
// supersampling gives the anti-aliasing.
const distSeg = (px, py, [x1, y1, x2, y2]) => {
  const ex = x2 - x1, ey = y2 - y1, L2 = ex * ex + ey * ey;
  const u = Math.max(0, Math.min(1, ((px - x1) * ex + (py - y1) * ey) / L2));
  return Math.hypot(px - x1 - ex * u, py - y1 - ey * u);
};
const line = (seg, w, color) => ({ hit: (x, y) => distSeg(x, y, seg) <= w / 2, color });
const disc = (cx, cy, r, color) => ({ hit: (x, y) => Math.hypot(x - cx, y - cy) <= r, color });
const ring = (cx, cy, r, w, color) => ({ hit: (x, y) => Math.abs(Math.hypot(x - cx, y - cy) - r) <= w / 2, color });
// The shot: a quadratic curve sampled into short segments, drawn as a thin dashed path.
const curve = (p0, p1, p2, w, color, dash) => {
  const segs = [];
  for (let i = 0; i < 40; i++) {
    if (dash && i % 2) continue;
    const at = (t) => [0, 1].map((k) => (1 - t) ** 2 * p0[k] + 2 * (1 - t) * t * p1[k] + t * t * p2[k]);
    const [a, b] = [at(i / 40), at((i + 1) / 40)];
    segs.push([a[0], a[1], b[0], b[1]]);
  }
  return { hit: (x, y) => segs.some((s) => distSeg(x, y, s) <= w / 2), color };
};

const gridLines = [];
for (let i = 1; i < 8; i++) {
  gridLines.push(line([i / 8, 0, i / 8, 1], 0.006, C.grid), line([0, i / 8, 1, i / 8], 0.006, C.grid));
}
const glass = { l: 0.6, r: 0.8, top: 0.6, base: 0.84 };
const shapes = [
  ...gridLines,
  curve([0.14, 0.82], [0.3, 0.3], [0.5, 0.29], 0.018, C.red, true),   // launch up to the bar's underside
  curve([0.5, 0.29], [0.66, 0.36], [0.7, 0.68], 0.018, C.red, true),  // deflected down into the glass
  { hit: (x, y) => x > glass.l && x < glass.r && y > glass.top && y < glass.base, color: [236, 214, 205] },
  line([glass.l, glass.top, glass.l, glass.base], 0.035, C.red),
  line([glass.r, glass.top, glass.r, glass.base], 0.035, C.red),
  line([glass.l - 0.06, glass.base, glass.r + 0.06, glass.base], 0.035, C.red),
  line([0.4, 0.17, 0.66, 0.31], 0.05, C.pencil),                       // the bar
  disc(0.7, 0.72, 0.065, C.steel),
  ring(0.7, 0.72, 0.065, 0.014, C.ink),
  disc(0.68, 0.7, 0.018, [250, 250, 250]),                             // highlight
];

function render(size, ss = 4) {
  const px = Buffer.alloc(size * size * 3);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    let r = 0, g = 0, b = 0;
    for (let sj = 0; sj < ss; sj++) for (let si = 0; si < ss; si++) {
      const x = (i + (si + 0.5) / ss) / size, y = (j + (sj + 0.5) / ss) / size;
      let c = C.paper;
      for (const s of shapes) if (s.hit(x, y)) c = s.color;
      r += c[0]; g += c[1]; b += c[2];
    }
    const o = (j * size + i) * 3, n = ss * ss;
    px[o] = Math.round(r / n); px[o + 1] = Math.round(g / n); px[o + 2] = Math.round(b / n);
  }
  return px;
}

// Minimal PNG writer: 8-bit RGB, one IDAT, no filtering.
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgb, channels = 3) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = channels === 4 ? 6 : 2;
  const row = size * channels;
  const raw = Buffer.alloc(size * (row + 1));
  for (let y = 0; y < size; y++) rgb.copy(raw, y * (row + 1) + 1, y * row, (y + 1) * row);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const outputs = [
  [join(ROOT, 'assets', 'icon.png'), 1024, 2],
  [join(ROOT, 'public', 'icons', 'icon-512.png'), 512, 4],
  [join(ROOT, 'public', 'icons', 'icon-192.png'), 192, 4],
  [join(ROOT, 'public', 'icons', 'icon-180.png'), 180, 4],
];
// Rounded square (iOS-style corner, 22.5% of the side), alpha from supersampled coverage.
function rounded(size, ss = 4) {
  const rgb = render(size, ss), out = Buffer.alloc(size * size * 4), R = 0.225;
  const inside = (x, y) => {
    const dx = Math.max(R - x, x - (1 - R), 0), dy = Math.max(R - y, y - (1 - R), 0);
    return dx * dx + dy * dy <= R * R;
  };
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    let n = 0;
    for (let sj = 0; sj < ss; sj++) for (let si = 0; si < ss; si++) n += inside((i + (si + 0.5) / ss) / size, (j + (sj + 0.5) / ss) / size);
    const o = (j * size + i) * 4, p = (j * size + i) * 3;
    out[o] = rgb[p]; out[o + 1] = rgb[p + 1]; out[o + 2] = rgb[p + 2]; out[o + 3] = Math.round((255 * n) / (ss * ss));
  }
  return out;
}
const splashPng = png(512, rounded(512, 3), 4);
for (const splash of [join(ROOT, 'assets', 'splash-icon.png'), join(ROOT, 'public', 'icons', 'splash-icon.png')]) {
  writeFileSync(splash, splashPng);
  console.log(`${splash} (512x512, rounded)`);
}

for (const [file, size, ss] of outputs) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, png(size, render(size, ss)));
  console.log(`${file} (${size}x${size})`);
}
