import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels';
import { legalPlacement } from './placement';
import { LAUNCHER, WORLD, buildWorld, isSpring, pieceEnds, simulate, solutionPieces, type Level } from '../physics';
import {
  shotPieces,
  boardIndex, boardNumbers, boardPieces, dragTo, emptySlots, pressAt, removeBar, rotateBy, rotateTo, shownAngle,
  ARM_CLEAR, MOVE_ARM, TRASH_CLEAR, TRASH_GRAB, TRASH_ROOM, distToSegment, trashObstacles, trashSpot, atSolution, hintSlots, moveArms, shotSlots, LEVER, leverEnd, leverLine, leverTipInside, slotsLegal, solutionSlots, tapChip, type Slot,
} from './pieces';

const level = LEVELS[0];
const twoPieces: Level = { ...level, pieces: [{ len: 90 }, { len: 60 }] };

describe('tray chips', () => {
  it('place, select, deselect, then remove', () => {
    let state = { slots: emptySlots(twoPieces), selected: null as number | null };
    state = tapChip(state.slots, state.selected, 1);
    expect(state.slots[1]).toMatchObject({ onBoard: true, x: 120, y: 290, deg: 0 });
    expect(state.selected).toBe(1);

    state = tapChip(state.slots, state.selected, 0);
    expect(state.selected).toBe(0);
    state = tapChip(state.slots, state.selected, 1); // on board, not selected: select it
    expect(state.selected).toBe(1);
    expect(state.slots[1].onBoard).toBe(true);

    state = tapChip(state.slots, state.selected, 1); // selected: deselect it, it stays on the board
    expect(state.slots[1].onBoard).toBe(true);
    expect(state.selected).toBeNull();

    state = removeBar(state.slots, 1); // the Remove button
    expect(state.slots[1].onBoard).toBe(false);
    expect(state.selected).toBeNull();
  });

  it('a re-placed piece starts flat at its drop spot', () => {
    let slots = emptySlots(level);
    slots = tapChip(slots, null, 0).slots;
    slots = dragTo(slots, { mode: 'rotate', k: 0 }, { x: 200, y: 400 });
    slots = removeBar(slots, 0).slots;
    slots = tapChip(slots, null, 0).slots;
    expect(slots[0]).toMatchObject({ x: 120, y: 220, deg: 0 });
  });
});

describe('pressAt', () => {
  const placed: Slot[] = [{ len: 90, onBoard: true, x: 200, y: 300, deg: 0 }];

  it('grabs a piece anywhere along it and remembers the offset', () => {
    const r = pressAt(placed, null, { x: 230, y: 305 }, true);
    expect(r.drag).toEqual({ mode: 'move', k: 0, ox: 30, oy: 5 });
    expect(r.selected).toBe(0);
  });

  it('the selected piece turns by its dotted lever, without jumping', () => {
    const [, , x2, y2, tx, ty] = [...pieceEnds(placed[0]).slice(0, 2), ...leverLine(placed[0], 2)];
    expect(tx).toBe(x2 + LEVER);
    // Anywhere along the lever grabs it; without a selection the bar's end just moves the bar.
    for (const x of [x2 + 3, x2 + 30, tx]) expect(pressAt(placed, 0, { x, y: ty + 4 }, true).drag?.mode).toBe('rotate');
    expect(pressAt(placed, null, { x: x2 + 3, y: y2 }, true).drag?.mode).toBe('move');
    const grab = pressAt(placed, 0, { x: tx, y: ty + 6 }, true).drag!;
    expect(dragTo(placed, grab, { x: tx, y: ty + 6 })[0].deg).toBe(0); // grabbed off-line: no jump
    // Swinging the tip down by 45° about the centre turns the bar 45°.
    const r = Math.hypot(tx - placed[0].x, ty + 6 - placed[0].y), b = Math.atan2(6, tx - placed[0].x) + Math.PI / 4;
    expect(dragTo(placed, grab, { x: placed[0].x + r * Math.cos(b), y: placed[0].y + r * Math.sin(b) })[0].deg).toBe(45);
  });

  it('tapping the other end moves the lever there and turns from that side', () => {
    const [x1, y1] = pieceEnds(placed[0]);
    const r = pressAt(placed, 0, { x: x1, y: y1 }, true, undefined, 2);
    expect(r.lever).toBe(1);
    expect(r.drag).toMatchObject({ mode: 'rotate', k: 0, end: 1 });
    // Pull end 1 straight up: the bar stands upright (end 1 on top).
    expect(Math.abs(dragTo(placed, r.drag!, { x: placed[0].x, y: placed[0].y - 50 })[0].deg)).toBe(90);
    expect(leverLine(placed[0], 1)[2]).toBe(x1 - LEVER);
  });

  it('knows when a lever tip would hang off the board', () => {
    const p = { len: 90, x: 292, y: 361, deg: 0 };
    expect(leverTipInside(p, 2)).toBe(false);
    expect(leverTipInside(p, 1)).toBe(true);
  });

  it('puts the lever where its tip stays on the board', () => {
    expect(leverEnd({ len: 90, x: 200, y: 300, deg: 0 })).toBe(2);
    expect(leverEnd({ len: 90, x: WORLD.width - 50, y: 300, deg: 0 })).toBe(1);
  });

  it('aims from the gun only when allowed (no jump: the drag starts where the finger is), and empty board deselects', () => {
    const p = { x: LAUNCHER.x + 30, y: LAUNCHER.y - 30 };
    expect(pressAt(placed, 0, p, true)).toEqual({ drag: { mode: 'open', ...p }, selected: null }); // touching the cannon switches to aiming
    expect(pressAt(placed, 0, p, false)).toEqual({ drag: null, selected: null });
    // with a bar on the board, a swipe on empty board doesn't move the gun
    expect(pressAt(placed, 0, { x: 350, y: 100 }, true)).toEqual({ drag: null, selected: null });
  });

  it('a fresh board (no bars placed) aims from a swipe anywhere', () => {
    const tray = [{ ...placed[0], onBoard: false }];
    expect(pressAt(tray, null, { x: 350, y: 100 }, true)).toEqual({ drag: { mode: 'open', x: 350, y: 100 }, selected: null });
    expect(pressAt(tray, null, { x: 350, y: 100 }, false)).toEqual({ drag: null, selected: null });
  });

  it('grabs the dotted aim line to swing the aim, but bars come first', () => {
    const far = { x: LAUNCHER.x + 200, y: LAUNCHER.y - 200 }; // on the line at 45°, power 100
    expect(pressAt([], null, far, true, { angle: 45, power: 100 }).drag?.mode).toBe('swing');
    expect(pressAt([], null, far, false, { angle: 45, power: 100 }).drag).toBeNull();
    expect(pressAt([], null, far, true, { angle: 10, power: 100 }).drag?.mode).toBe('open');
  });

  it('ignores pieces in the tray', () => {
    const tray = [{ ...placed[0], onBoard: false }];
    expect(pressAt(tray, null, { x: 200, y: 300 }, true).drag?.mode).toBe('open');
  });
});

describe('dragTo', () => {
  const slots: Slot[] = [{ len: 90, onBoard: true, x: 200, y: 300, deg: 0 }];

  it('moves with the grab offset and stays on the board', () => {
    const drag = { mode: 'move' as const, k: 0, ox: 30, oy: 5 };
    expect(dragTo(slots, drag, { x: 130, y: 405 })[0]).toMatchObject({ x: 100, y: 400 });
    expect(dragTo(slots, drag, { x: -50, y: 2000 })[0]).toMatchObject({ x: 10, y: WORLD.ground - 10 });
    expect(slots[0].x).toBe(200); // inputs untouched
  });

  it('rotates to whole degrees, pointing the handle at the finger', () => {
    const r = dragTo(slots, { mode: 'rotate', k: 0 }, { x: 250, y: 351.3 });
    expect(r[0].deg).toBe(46);
    expect(Number.isInteger(r[0].deg)).toBe(true);
  });
});

describe('solution and board mapping', () => {
  it('solutionSlots matches the physics solutionPieces', () => {
    for (const l of LEVELS) expect(boardPieces(solutionSlots(l))).toEqual(solutionPieces(l));
  });

  it('boardIndex counts only on-board pieces', () => {
    const slots: Slot[] = [
      { len: 90, onBoard: false, x: 0, y: 0, deg: 0 },
      { len: 60, onBoard: true, x: 0, y: 0, deg: 0 },
    ];
    expect(boardIndex(slots, 1)).toBe(0);
    expect(boardIndex(slots, 0)).toBeNull();
    expect(boardIndex(slots, null)).toBeNull();
  });
});

describe('rotation controls', () => {
  const slots: Slot[] = [{ len: 90, onBoard: true, x: 200, y: 300, deg: 0 }];

  it('shows 0–179° counter-clockwise, like the board label', () => {
    expect(shownAngle(0)).toBe(0);
    expect(shownAngle(-30)).toBe(30);
    expect(shownAngle(30)).toBe(150);
    expect(shownAngle(-180)).toBe(0);
  });

  it('sets and nudges whole degrees, wrapping around', () => {
    expect(shownAngle(rotateTo(slots, 0, 137)[0].deg)).toBe(137);
    expect(shownAngle(rotateBy(slots, 0, -1)[0].deg)).toBe(179);
    expect(shownAngle(rotateBy(rotateTo(slots, 0, 179), 0, 1)[0].deg)).toBe(0);
    expect(Number.isInteger(rotateTo(slots, 0, 12.6)[0].deg)).toBe(true);
    expect(slots[0].deg).toBe(0); // inputs untouched
  });

  it('a nudge turns the bar the way its label says', () => {
    const turned = rotateBy(slots, 0, 10)[0];
    const [, y1, , y2] = pieceEnds(turned);
    expect(y2).toBeLessThan(y1); // counter-clockwise: the right end rises (y points down)
  });

  it('numbers on-board bars as on the tray chips', () => {
    const three: Slot[] = [
      { len: 90, onBoard: false, x: 0, y: 0, deg: 0 },
      { len: 70, onBoard: true, x: 0, y: 0, deg: 0 },
      { len: 70, onBoard: true, x: 0, y: 0, deg: 0 },
    ];
    expect(boardNumbers(three)).toEqual([2, 3]);
  });
});

describe('saved shots', () => {
  it('put the saved bars back on the board', () => {
    const l = LEVELS.find((x) => x.pieces.length === 3)!;
    const s = shotSlots(l, { pieces: [{ x: 100, y: 200, deg: 10 }, { x: 150, y: 250, deg: 20 }] });
    expect(s.map((x) => x.onBoard)).toEqual([true, true, false]);
    expect(s[1]).toMatchObject({ x: 150, y: 250, deg: 20, len: l.pieces[1].len });
  });
});

describe('hints', () => {
  const three = LEVELS.find((l) => l.pieces.length === 3)!;

  it('place the solution bars one at a time, then run out', () => {
    let slots = emptySlots(three);
    for (let k = 0; k < 3; k++) {
      const h = hintSlots(three, slots)!;
      expect(h.k).toBe(k);
      slots = h.slots;
      expect(atSolution(three, slots, k)).toBe(true);
    }
    expect(hintSlots(three, slots)).toBeNull();
  });

  it('send a clashing bar back to the tray', () => {
    const p = three.solution!.pieces[0];
    const slots = emptySlots(three).map((s, i) => (i === 1 ? { ...s, onBoard: true, x: p.x, y: p.y, deg: p.deg } : s));
    const h = hintSlots(three, slots)!;
    expect(h.k).toBe(0);
    expect(h.slots[1].onBoard).toBe(false);
    expect(slotsLegal(three, h.slots)).toBe(true);
  });
});

describe('move handles', () => {
  const bar = (x: number, y: number, deg = 0): Slot => ({ x, y, deg, len: 90, onBoard: true });

  it('dragging the x grip slides the bar sideways only', () => {
    const slots = [bar(200, 300)];
    const [gx] = moveArms(slots[0], 2);
    const r = pressAt(slots, 0, { x: gx[0], y: gx[1] }, true, undefined, 2);
    expect(r.drag).toMatchObject({ mode: 'move', k: 0, axis: 'x' });
    const moved = dragTo(slots, r.drag!, { x: gx[0] + 30, y: gx[1] + 50 });
    expect(moved[0].x).toBe(230);
    expect(moved[0].y).toBe(300);
  });

  it('dragging the y grip slides the bar up and down only', () => {
    const slots = [bar(200, 300, 90)];
    const [, gy] = moveArms(slots[0], 2);
    const r = pressAt(slots, 0, { x: gy[0], y: gy[1] }, true, undefined, 2);
    expect(r.drag).toMatchObject({ mode: 'move', axis: 'y' });
    const moved = dragTo(slots, r.drag!, { x: gy[0] + 40, y: gy[1] - 20 });
    expect(moved[0].x).toBe(200);
    expect(moved[0].y).toBe(280);
  });

  it('keeps both grips on the board and off the lever side', () => {
    for (const [x, y] of [[30, 30], [370, 30], [30, 520], [370, 520], [200, 280]]) {
      for (const deg of [0, 45, 90, 135, -30]) {
        for (const lever of [1, 2] as const) {
          for (const [gx, gy] of moveArms(bar(x, y, deg), lever)) {
            expect(gx).toBeGreaterThan(0); expect(gx).toBeLessThan(WORLD.width);
            expect(gy).toBeGreaterThan(0); expect(gy).toBeLessThan(WORLD.ground);
          }
        }
      }
    }
  });

  it('each grip sits well past the end of the bar, even when the bar lies along that axis', () => {
    // Flat bar: the x arm runs along the bar, so its grip must clear the bar's end (45 from the centre) by ARM_CLEAR.
    const [gx] = moveArms(bar(200, 300, 0), 2);
    expect(Math.abs(gx[0] - 200)).toBeGreaterThanOrEqual(45 + ARM_CLEAR);
    // Upright bar: the same for the y arm.
    const [, gy] = moveArms(bar(200, 300, 90), 2);
    expect(Math.abs(gy[1] - 300)).toBeGreaterThanOrEqual(45 + ARM_CLEAR);
    // Across the axis the arm keeps its usual length.
    const [, gyFlat] = moveArms(bar(200, 300, 0), 2);
    expect(Math.abs(gyFlat[1] - 300)).toBe(MOVE_ARM);
  });

  it('the remove badge sits on the board, clear of the bar and its handles', () => {
    for (const [x, y] of [[30, 30], [370, 30], [30, 520], [370, 520], [200, 280], [120, 220]]) {
      for (const deg of [0, 30, 45, 90, 126, 135, -30]) {
        for (const lever of [1, 2] as const) {
          const b = bar(x, y, deg);
          const [tx, ty] = trashSpot(b, lever);
          expect(tx).toBeGreaterThan(0); expect(tx).toBeLessThan(WORLD.width);
          expect(ty).toBeGreaterThan(0); expect(ty).toBeLessThan(WORLD.ground);
          const [ax, ay] = leverLine(b, lever).slice(2);
          expect(Math.hypot(tx - ax, ty - ay), `${x},${y} ${deg}° lever ${lever}`).toBeGreaterThan(20);
          for (const [gx, gy] of moveArms(b, lever)) expect(Math.hypot(tx - gx, ty - gy)).toBeGreaterThan(20);
          // Well clear of the bar itself for a fat finger: TRASH_CLEAR in open board, and never under 30 even in a corner.
          const fromBar = distToSegment({ x: tx, y: ty }, pieceEnds(b));
          expect(fromBar, `${x},${y} ${deg}°`).toBeGreaterThanOrEqual(30);
          if (x > 100 && x < 300 && y > 100 && y < 440) expect(fromBar, `${x},${y} ${deg}°`).toBeGreaterThanOrEqual(TRASH_CLEAR);
        }
      }
    }
  });

  it('on every level the remove badge sits in open space, never on a wall, spikes, a pad, the glass or the gun', () => {
    const onPoly = (x: number, y: number, poly: [number, number][], pad: number) => {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside || poly.some((pt, i) => distToSegment({ x, y }, [pt[0], pt[1], poly[(i + 1) % poly.length][0], poly[(i + 1) % poly.length][1]]) < pad);
    };
    for (const level of LEVELS) {
      const obs = trashObstacles(level, []);
      for (let x = 40; x <= 360; x += 40) for (let y = 40; y <= 480; y += 40) for (const deg of [0, 45, 90, 135]) {
        const b = { x, y, deg, len: level.pieces[0].len };
        if (!legalPlacement(level, [b])) continue;
        const [tx, ty] = trashSpot(b, 2, obs);
        for (const poly of obs.polygons) expect(onPoly(tx, ty, poly, 11), `${level.id} ${x},${y} ${deg}°`).toBe(false);
      }
    }
  });

  it('the remove badge keeps off the other bars on the board', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    let boards = 0;
    for (const level of LEVELS.filter((l) => l.pieces.length > 1)) {
      for (let t = 0; t < 300; t++) {
        const bars = level.pieces.map((p) => ({ x: 20 + rnd() * 360, y: 20 + rnd() * 500, deg: Math.round(rnd() * 180), len: p.len }));
        if (!legalPlacement(level, bars)) continue;
        boards++;
        bars.forEach((b, k) => {
          const others = bars.filter((_, j) => j !== k);
          const [tx, ty] = trashSpot(b, 2, trashObstacles(level, others));
          for (const o of others) expect(distToSegment({ x: tx, y: ty }, pieceEnds(o)), level.id).toBeGreaterThanOrEqual(TRASH_ROOM);
        });
      }
    }
    expect(boards).toBeGreaterThan(100);
  });

  it('a tap on the remove badge starts a remove, not a move', () => {
    const slots = [bar(200, 300, 126)];
    const [tx, ty] = trashSpot(slots[0], 2);
    expect(pressAt(slots, 0, { x: tx, y: ty }, true, undefined, 2).drag).toMatchObject({ mode: 'trash', k: 0 });
    // Not selected: no badge, so the same spot is just board.
    expect(pressAt(slots, null, { x: tx + TRASH_GRAB * 3, y: ty }, true, undefined, 2).drag?.mode).not.toBe('trash');
  });

  it('a touch on the bar itself still moves it freely', () => {
    const slots = [bar(200, 300)];
    const r = pressAt(slots, 0, { x: 190, y: 300 }, true, undefined, 2);
    expect(r.drag).toMatchObject({ mode: 'move' });
    expect((r.drag as { axis?: string }).axis).toBeUndefined();
  });
});

describe('shotPieces', () => {
  it('gives a saved winning shot its spring bars back, so it still lands when replayed or drawn', () => {
    const springy = LEVELS.filter((l) => l.pieces.some((p) => isSpring(p.restitution)));
    expect(springy.length).toBeGreaterThan(0);
    for (const level of springy) {
      const s = level.solution!;
      // As stored by a win: only where the bars went.
      const shot = { pieces: s.pieces.map((p, k) => ({ ...p, len: level.pieces[k].len })), angle: s.angle, power: s.power };
      const pieces = shotPieces(level, shot);
      expect(pieces.map((p) => p.restitution)).toEqual(level.pieces.map((p) => p.restitution));
      expect(simulate(buildWorld(level, pieces), s.angle, s.power).success).toBe(true);
    }
  });
});
