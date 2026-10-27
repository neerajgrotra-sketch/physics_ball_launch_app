// Daily puzzles. Run: npx tsx tools/make-dailies.ts <first> <count> [samples]
// Builds a random layout for each puzzle number from its own seed (so a number always gives the same attempt), tougher through the
// week (game/daily.ts DAILY_TIERS: Monday gentle, Sunday hardest), and keeps it only if findSolution() finds an answer that bounces off
// every bar and is forgiving enough to land on any phone (MIN_ROBUSTNESS), with a sensible par. A rejected layout is retried with the
// next seed. Each kept puzzle is written to levels/daily/NNN.json with its stored answer and par, like a designed level; then
// levels/daily/index.ts is rewritten to list every file there. Never hand-edit those files: change this generator and run it again.
import fs from 'node:fs';
import { WORLD, glassBox, type Block, type Level } from '../physics';
import { DAILY_TIERS, type DailyTier } from '../game/daily';
import { findSolution } from './find-solution';

const DIR = 'levels/daily';
const G = WORLD.ground;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const NAMES = [
  'Carom', 'Ricochet', 'Kiss shot', 'Rebound', 'Ping', 'Long way round', 'Doglegs', 'Pinball wizard', 'Straight down', 'Over the top',
  'Two-step', 'Drop shot', 'Backspin', 'Lob', 'Rattle', 'Tin can', 'Billiard', 'Sidewinder', 'Hook', 'Bank job', 'Trick shot',
  'Glance', 'Skipping stone', 'Zigzag', 'Echo', 'Boomerang', 'High wire', 'Undercut', 'Ladder', 'Spiral', 'Top shelf', 'Tight squeeze',
  'Clean sheet', 'Rim shot', 'Stair step', 'Swish', 'Off the glass', 'Keyhole', 'Chip in', 'Curveball',
];

const HINTS: Record<DailyTier, string> = {
  1: 'One bar: bounce the ball off it into the glass.',
  2: 'Two bars, and the ball has to bounce off both.',
  3: 'Walls in the way. Use every bar to get round them.',
  4: 'Three bars and some obstacles. Plan the whole route.',
  5: "Sunday's toughest: three bars, walls and spikes.",
};

/** A layout for one tier, from a seeded random source. Numbers stay whole so the files read cleanly. */
function layout(tier: DailyTier, r: () => number): Omit<Level, 'id' | 'name' | 'hint' | 'solution' | 'par'> {
  const int = (a: number, b: number) => Math.round(a + r() * (b - a));
  const bars = { 1: [90], 2: [90, 80], 3: [90, 80], 4: [90, 80, 70], 5: [90, 70, 70] }[tier];
  const raised = tier >= 2 && r() < 0.45;
  const glass = { x: int(190, 350), w: int(36, 44), h: int(50, 56), ...(raised ? { base: int(360, 460) } : {}) };
  const g = glassBox(glass);
  const blocks: Block[] = [];
  const hazards: Block[] = [];
  const pads: Block[] = [];
  // Walls stand up from the floor or hang from the ceiling, clear of the cannon and of the glass.
  const wallCount = tier <= 2 ? (tier === 2 && r() < 0.3 ? 1 : 0) : tier === 3 ? int(1, 2) : tier === 4 ? int(1, 2) : 2;
  for (let n = 0; n < wallCount; n++) {
    const w = int(24, 30), h = int(130, 260), fromFloor = r() < 0.55;
    for (let tries = 0; tries < 20; tries++) {
      const x = int(125, 365);
      const left = x - w / 2, right = x + w / 2;
      const clearGlass = right < g.l - 34 || left > g.r + 34;
      const clearWalls = blocks.every((b) => Math.abs(b.x - x) > 70);
      if (!clearGlass || !clearWalls) continue;
      blocks.push({ x, y: fromFloor ? G - h / 2 : h / 2, w, h });
      break;
    }
  }
  // Spikes on the floor between the cannon and the glass (or on the ceiling), from tier 3; a spring pad instead, sometimes, at tier 4.
  if (tier >= 3 && r() < (tier === 3 ? 0.3 : 0.55)) {
    if (tier === 4 && r() < 0.4) {
      const x = int(160, 260);
      if (x + 45 < g.l - 20 || x - 45 > g.r + 20) pads.push({ x, y: 534, w: 90, h: 12 });
    } else if (r() < 0.7) {
      const w = int(60, 120), x = int(130 + w / 2, 380 - w / 2);
      const overGlass = !(x + w / 2 < g.l - 24 || x - w / 2 > g.r + 24) && !raised;
      if (!overGlass && blocks.every((b) => Math.abs(b.x - x) > b.w / 2 + w / 2 + 10)) hazards.push({ x, y: 528, w, h: 24 });
    } else {
      const w = int(120, 220);
      hazards.push({ x: int(120 + w / 2, 390 - w / 2), y: 22, w, h: 24 });
    }
  }
  return {
    glass, fixed: [], pieces: bars.map((len) => ({ len })),
    ...(blocks.length ? { blocks } : {}), ...(hazards.length ? { hazards } : {}), ...(pads.length ? { pads } : {}),
  };
}

/** Par stays within reach for a daily: at most this many bounces more than the bars it has. */
const MAX_EXTRA_PAR = 4;

const [first = 1, count = 7, samples = 150_000] = process.argv.slice(2).map(Number);
fs.mkdirSync(DIR, { recursive: true });
for (let n = first; n < first + count; n++) {
  const tier = DAILY_TIERS[(n - 1) % 7];
  const file = `${DIR}/${String(n).padStart(3, '0')}.json`;
  if (fs.existsSync(file)) { console.log(`#${n}: already made`); continue; }
  const t0 = Date.now();
  let made = false;
  for (let attempt = 0; attempt < 40 && !made; attempt++) {
    const seed = n * 1000 + attempt;
    const r = rng(seed);
    const base = layout(tier, r);
    const level = { id: `daily-${String(n).padStart(3, '0')}`, name: NAMES[(n - 1) % NAMES.length], hint: HINTS[tier], ...base } as Level;
    const sol = findSolution(level, { samples, seed, want: 80 });
    if (!sol || sol.par > level.pieces.length + MAX_EXTRA_PAR) continue;
    const { robustness, par, ...solution } = sol;
    fs.writeFileSync(file, JSON.stringify({ ...level, tier, par, solution }, null, 2) + '\n');
    console.log(`#${n} tier ${tier}: par ${par}, robustness ${robustness}/49, seed ${seed}, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    made = true;
  }
  if (!made) console.log(`#${n} tier ${tier}: no puzzle after 40 layouts`);
}

// The index lists every puzzle file in number order, so the game always matches what is on disk.
const files = fs.readdirSync(DIR).filter((f) => /^\d{3}\.json$/.test(f)).sort();
fs.writeFileSync(`${DIR}/index.ts`, [
  '// Generated by tools/make-dailies.ts: every daily puzzle, in number order. Do not edit by hand.',
  "import type { Level } from '../../physics';",
  ...files.map((f, i) => `import d${i} from './${f}';`),
  '',
  'export interface DailyLevel extends Level { tier: 1 | 2 | 3 | 4 | 5 }',
  `export const DAILIES = [${files.map((_, i) => `d${i}`).join(', ')}] as unknown as DailyLevel[];`,
  '',
].join('\n'));
