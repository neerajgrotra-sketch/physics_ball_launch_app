import { LAUNCHER, solutionPieces, type Level, type PlacedPiece } from '../../physics';
import { toGrid } from '../../game/aim';
import { leverEnd, leverLine, moveArms } from '../../game/pieces';
import { TOUR_SCENES, type TourPicture } from '../../game/tour';
import type { Ctx, SceneButton, SceneState } from './TourScene';

// The tour's scenes (components/tour/TourScene.tsx plays them on a loop). Each one sets up a real level (game/tour.ts TOUR_SCENES)
// and acts out a page: the ghost finger drags the aim and the bars exactly as a player would, through the game's own mappings (aimAt's
// drag distance, the move arms, the turn lever), and every shot is simulate() played back with its sounds.

export interface Scene { level: string; setup: (s: SceneState, level: Level) => SceneState; run: (ctx: Ctx) => Promise<void> }

const LAUNCH: SceneButton = { id: 'launch', label: 'Launch', x: 344, y: 230, w: 84, kind: 'primary' };
const REPLAY: SceneButton = { id: 'launch', label: 'Replay ▶', x: 344, y: 230, w: 84, kind: 'primary' };
const chip = (id: string, label: string, on = false): SceneButton => ({ id, label, x: 56, y: 230, w: 72, kind: 'chip', on });

const readout = (angle: number, power: number) => `${angle.toFixed(1)}°   power ${power.toFixed(1)}`;

/** Where a finger dragging out from the cannon sits for an aim (the inverse of game/aim.ts aimAt). */
export function aimPoint(angle: number, power: number) {
  const r = 20 + 2.6 * power, a = (angle * Math.PI) / 180;
  return { x: LAUNCHER.x + r * Math.cos(a), y: LAUNCHER.y - r * Math.sin(a) };
}

const press = (ctx: Ctx, down: boolean) => ctx.set((s) => ({ finger: { ...s.finger, down } }));
const say = (ctx: Ctx, text: string, color: 'ink' | 'red' | 'pencil' = 'ink') => ctx.set({ note: { text, color } });

/** Drag the aim from where it is through each (angle, power), finger on the drag point, the cannon and the dotted line following. */
async function dragAim(ctx: Ctx, to: [number, number, string?][]) {
  const s = ctx.get();
  const start = aimPoint(s.angle, s.power);
  await ctx.move(start.x, start.y);
  press(ctx, true);
  await ctx.wait(180);
  for (const [a, p, note] of to) {
    if (note) say(ctx, note, 'pencil');
    const a0 = ctx.get().angle, p0 = ctx.get().power;
    await ctx.tween(Math.max(500, Math.abs(a - a0) * 22 + Math.abs(p - p0) * 18), (k) => {
      const angle = toGrid(a0 + (a - a0) * k), power = toGrid(p0 + (p - p0) * k);
      const f = aimPoint(angle, power);
      ctx.set((t) => ({ angle, power, readout: readout(angle, power), finger: { ...t.finger, x: f.x, y: f.y } }));
    });
    await ctx.wait(250);
  }
  press(ctx, false);
  await ctx.wait(200);
}

/** The finger taps Launch (or Replay), steps out of the way, and the shot plays. */
async function launch(ctx: Ctx, onHit?: Parameters<Ctx['shoot']>[0]) {
  const b = ctx.get().buttons.find((x) => x.id === 'launch') ?? LAUNCH;
  await ctx.move(b.x + 4, b.y + 2);
  await ctx.tap();
  ctx.set((s) => ({ finger: { ...s.finger, shown: false } }));
  return ctx.shoot(onHit);
}

/** Change piece 0 and keep the finger on whatever it is holding. */
const setBar = (ctx: Ctx, bar: PlacedPiece, finger: { x: number; y: number }) =>
  ctx.set((s) => ({ pieces: [bar, ...s.pieces.slice(1)], finger: { ...s.finger, ...finger } }));

/** Drag bar 0 by its middle to (x, y). */
async function dragBar(ctx: Ctx, x: number, y: number) {
  const b = ctx.get().pieces[0];
  await ctx.move(b.x, b.y);
  press(ctx, true);
  ctx.set({ selected: 0, lever: leverEnd(b) });
  await ctx.wait(150);
  await ctx.tween(900, (k) => {
    const nx = Math.round(b.x + (x - b.x) * k), ny = Math.round(b.y + (y - b.y) * k);
    setBar(ctx, { ...b, x: nx, y: ny }, { x: nx, y: ny });
  });
  press(ctx, false);
  await ctx.wait(250);
}

/** Slide bar 0 along one axis by its move-arm grip. */
async function slide(ctx: Ctx, axis: 0 | 1, to: number) {
  const s = ctx.get(), b = s.pieces[0];
  const [gx, gy] = moveArms(b, s.lever)[axis];
  await ctx.move(gx, gy);
  press(ctx, true);
  await ctx.wait(150);
  const from = axis === 0 ? b.x : b.y;
  await ctx.tween(800, (k) => {
    const v = Math.round(from + (to - from) * k), d = v - from;
    setBar(ctx, axis === 0 ? { ...b, x: v } : { ...b, y: v }, axis === 0 ? { x: gx + d, y: gy } : { x: gx, y: gy + d });
  });
  press(ctx, false);
  await ctx.wait(250);
}

/** Turn bar 0 by dragging the tip of its lever round to `deg`. */
async function turn(ctx: Ctx, deg: number) {
  const s = ctx.get(), b = s.pieces[0], lever = s.lever;
  const [, , tx, ty] = leverLine(b, lever);
  await ctx.move(tx, ty);
  press(ctx, true);
  await ctx.wait(150);
  await ctx.tween(Math.max(700, Math.abs(deg - b.deg) * 18), (k) => {
    const d = Math.round(b.deg + (deg - b.deg) * k);
    const next = { ...b, deg: d };
    const [, , x, y] = leverLine(next, lever);
    setBar(ctx, next, { x, y });
  });
  press(ctx, false);
  await ctx.wait(250);
}

const missed = (touched: boolean[]) => touched.map((t, i) => (t ? 0 : i + 1)).filter(Boolean);

export const SCENES: Record<Exclude<TourPicture, 'pieces'>, Scene> = {
  // A three-bar chain into the glass, then the same shot again: the second path lies exactly on the first.
  welcome: {
    level: TOUR_SCENES.welcome.level,
    setup: (s, level) => ({ ...s, pieces: solutionPieces(level), numbers: [1, 2, 3], buttons: [LAUNCH] }),
    async run(ctx) {
      await launch(ctx);
      await ctx.wait(1000);
      say(ctx, 'Same shot again…');
      await launch(ctx);
      say(ctx, '…exactly the same path', 'red');
      await ctx.wait(1400);
    },
  },

  // A try that misses a bar (faint trail, and no win), a small change of power, then the shot that goes in off both.
  goal: {
    level: TOUR_SCENES.goal.level,
    setup: (s, level) => ({
      ...s, pieces: solutionPieces(level), numbers: [1, 2], buttons: [LAUNCH],
      power: TOUR_SCENES.goal.miss.power, readout: readout(s.angle, TOUR_SCENES.goal.miss.power),
    }),
    async run(ctx) {
      const res = await launch(ctx);
      say(ctx, `Missed Bar ${missed(res.touched).join(' and ')}: no win`, 'red');
      await ctx.wait(1400);
      ctx.set({ note: null });
      await dragAim(ctx, [[ctx.level.solution!.angle, ctx.level.solution!.power, 'A little less power']]);
      ctx.set({ note: null });
      const win = await launch(ctx);
      if (win.success) say(ctx, 'Off every bar and in the glass', 'red');
      await ctx.wait(1200);
    },
  },

  // The finger drags out from the cannon: round it turns the angle, in and out sets the power; then it launches.
  aim: {
    level: TOUR_SCENES.aim.level,
    setup: (s, level) => ({ ...s, pieces: solutionPieces(level), numbers: [1], buttons: [LAUNCH], angle: 25, power: 45, readout: readout(25, 45) }),
    async run(ctx) {
      const { angle, power } = ctx.level.solution!;
      await dragAim(ctx, [
        [70, 45, 'Round the cannon: angle'],
        [40, 45],
        [40, 75, 'In and out: power'],
        [40, 30],
        [angle, power, 'Let go, then Launch'],
      ]);
      const res = await launch(ctx);
      if (res.success) say(ctx, 'In!', 'red');
      await ctx.wait(1000);
    },
  },

  // Tap the chip, the bar appears; drag it, slide it on each arm, turn it with the lever; launch off it into the glass.
  bars: {
    level: TOUR_SCENES.bars.level,
    setup: (s) => ({ ...s, buttons: [chip('bar1', 'Bar 1'), LAUNCH] }),
    async run(ctx) {
      const goal = ctx.level.solution!.pieces[0], { drop, turnTo } = TOUR_SCENES.bars;
      const b = await (async () => {
        const chipBtn = ctx.get().buttons[0];
        say(ctx, 'Tap a chip to place a bar', 'pencil');
        await ctx.move(chipBtn.x, chipBtn.y + 2);
        await ctx.tap();
        const bar: PlacedPiece = { len: ctx.level.pieces[0].len, x: drop.x, y: drop.y, deg: 0 };
        ctx.set({ pieces: [bar], numbers: [1], selected: 0, lever: leverEnd(bar), buttons: [chip('bar1', 'Bar 1', true), LAUNCH] });
        await ctx.wait(500);
        return bar;
      })();
      say(ctx, 'Drag it anywhere', 'pencil');
      await dragBar(ctx, b.x + 60, b.y + 70);
      say(ctx, 'Or slide it on an arm', 'pencil');
      await slide(ctx, 0, goal.x);
      await slide(ctx, 1, goal.y);
      say(ctx, 'Turn it with the round handle', 'pencil');
      await turn(ctx, turnTo);
      ctx.set({ note: null });
      const res = await launch(ctx);
      if (res.success) say(ctx, 'Off the bar and in', 'red');
      await ctx.wait(1000);
    },
  },

  // The live bounce counter against par, then the stars pop in.
  stars: {
    level: TOUR_SCENES.stars.level,
    setup: (s, level) => ({ ...s, pieces: solutionPieces(level), numbers: [1, 2], buttons: [LAUNCH], note: { text: `0 bounces / par ${level.par}`, color: 'ink' } }),
    async run(ctx) {
      let n = 0;
      const res = await launch(ctx, (h) => { if (h.counts) say(ctx, `${++n} bounce${n === 1 ? '' : 's'} / par ${ctx.level.par}`); });
      if (!res.success) return;
      await ctx.wait(300);
      for (let k = 0; k < 3; k++) {
        ctx.feedback.star(k);
        await ctx.tween(260, (e) => ctx.set((s) => ({ stars: s.stars.map((v, i) => (i === k ? e : v)) })));
      }
      say(ctx, 'Par: three stars', 'red');
      await ctx.wait(1500);
    },
  },

  // Solve: a hint puts the next bar in place, the full answer places the rest, sets the aim and launches; then Replay plays it again.
  help: {
    level: TOUR_SCENES.help.level,
    setup: (s) => ({ ...s, angle: 45, power: 50, buttons: [chip('solve', 'Solve')] }),
    async run(ctx) {
      const answer = solutionPieces(ctx.level);
      const solve = ctx.get().buttons[0];
      const reveal = async (i: number) => {
        ctx.set({ ghosts: [answer[i]] });
        await ctx.wait(600);
        ctx.set((s) => ({ ghosts: [], pieces: [...s.pieces, answer[i]], numbers: [...s.numbers, i + 1] }));
        await ctx.wait(500);
      };
      await ctx.move(solve.x, solve.y + 2);
      await ctx.tap();
      say(ctx, 'A hint: the next bar', 'pencil');
      await reveal(0);
      await ctx.wait(500);
      await ctx.move(solve.x, solve.y + 2);
      await ctx.tap();
      say(ctx, 'Or the whole answer', 'pencil');
      ctx.set((s) => ({ finger: { ...s.finger, shown: false } }));
      for (let i = 1; i < answer.length; i++) await reveal(i);
      const { angle, power } = ctx.level.solution!;
      const a0 = ctx.get().angle, p0 = ctx.get().power;
      await ctx.tween(700, (k) => {
        const a = toGrid(a0 + (angle - a0) * k), p = toGrid(p0 + (power - p0) * k);
        ctx.set({ angle: a, power: p });
      });
      ctx.set({ note: null });
      await ctx.shoot();
      ctx.set((s) => ({ buttons: [...s.buttons, REPLAY] }));
      await ctx.wait(700);
      say(ctx, 'Replay shows it again', 'pencil');
      await launch(ctx);
      await ctx.wait(800);
    },
  },

  // Learn the ropes: the bar goes onto its dashed outline, turns to match, and snaps in.
  ready: {
    level: TOUR_SCENES.ready.level,
    setup: (s, level) => ({
      ...s, ghosts: [solutionPieces(level)[0]],
      pieces: [{ len: level.pieces[0].len, x: TOUR_SCENES.ready.drop.x, y: TOUR_SCENES.ready.drop.y, deg: 0 }], numbers: [1],
    }),
    async run(ctx) {
      const goal = solutionPieces(ctx.level)[0];
      say(ctx, 'Drag it onto the outline', 'pencil');
      await dragBar(ctx, goal.x, goal.y);
      say(ctx, 'Turn it to match', 'pencil');
      await turn(ctx, TOUR_SCENES.ready.turnTo);
      ctx.set((s) => ({ pieces: [goal], ghosts: [], selected: null, finger: { ...s.finger, shown: false } }));
      ctx.feedback.star(2);
      say(ctx, 'Snapped into place ✓', 'red');
      await ctx.wait(1600);
    },
  },
};
