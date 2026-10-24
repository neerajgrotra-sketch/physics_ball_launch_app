import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels';
import { LAUNCHER, WORLD, pieceEnds, solutionPieces, type Level } from '../physics';
import {
  boardIndex, boardNumbers, boardPieces, dragTo, emptySlots, pressAt, removeBar, rotateBy, rotateTo, shownAngle,
  atSolution, hintSlots, slotsLegal, solutionSlots, tapChip, type Slot,
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

  it('the end handle of the selected piece rotates it', () => {
    const [, , x2, y2] = pieceEnds(placed[0]);
    expect(pressAt(placed, 0, { x: x2 + 3, y: y2 }, true).drag).toEqual({ mode: 'rotate', k: 0 });
    expect(pressAt(placed, null, { x: x2 + 3, y: y2 }, true).drag?.mode).toBe('move');
  });

  it('aims near the launcher only when allowed, and empty board deselects', () => {
    const p = { x: LAUNCHER.x + 30, y: LAUNCHER.y - 30 };
    expect(pressAt(placed, 0, p, true)).toEqual({ drag: { mode: 'aim' }, selected: 0 });
    expect(pressAt(placed, 0, p, false)).toEqual({ drag: null, selected: null });
    expect(pressAt(placed, 0, { x: 350, y: 100 }, true)).toEqual({ drag: null, selected: null });
  });

  it('grabs the dotted aim line to swing the aim, but bars come first', () => {
    const far = { x: LAUNCHER.x + 200, y: LAUNCHER.y - 200 }; // on the line at 45°, power 100
    expect(pressAt([], null, far, true, { angle: 45, power: 100 }).drag?.mode).toBe('swing');
    expect(pressAt([], null, far, false, { angle: 45, power: 100 }).drag).toBeNull();
    expect(pressAt([], null, far, true, { angle: 10, power: 100 }).drag).toBeNull();
  });

  it('ignores pieces in the tray', () => {
    const tray = [{ ...placed[0], onBoard: false }];
    expect(pressAt(tray, null, { x: 200, y: 300 }, true).drag).toBeNull();
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
