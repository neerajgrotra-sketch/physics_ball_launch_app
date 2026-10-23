import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels';
import { glassBox, solutionPieces, type Level } from '../physics';
import { emptySlots, illegalBars, rotateLegal, rotateToLegal, shownAngle, slotsLegal, tapChip, type Slot } from './pieces';
import { illegalPieces, legalPlacement } from './placement';

const crossfire = LEVELS.find((l) => l.id.startsWith('04'))!; // glass floats mid-board
const g = glassBox(crossfire.glass);

describe('placement rule', () => {
  it('every stored solution can be placed by hand', () => {
    for (const level of LEVELS) expect(legalPlacement(level, solutionPieces(level))).toBe(true);
  });

  it('a bar through the glass is not allowed (the bug in the screenshot)', () => {
    const through = { len: 70, x: (g.l + g.r) / 2, y: (g.rim + g.base) / 2, deg: 45 };
    expect(illegalPieces(crossfire, [through])).toEqual([true]);
    const touching = { len: 70, x: g.r + 40, y: g.rim, deg: 0 }; // its left end reaches the glass wall
    expect(legalPlacement(crossfire, [touching])).toBe(false);
  });

  it('bars may not overlap: both are marked', () => {
    const a = { len: 90, x: 120, y: 120, deg: 0 }, b = { len: 90, x: 120, y: 125, deg: 0 };
    const far = { len: 70, x: 300, y: 80, deg: 0 };
    expect(illegalPieces(crossfire, [a, b, far])).toEqual([true, true, false]);
  });
});

describe('placing and rotating stay legal', () => {
  it('a bar from the tray always lands somewhere allowed, one after another', () => {
    for (const level of LEVELS) {
      let state = { slots: emptySlots(level), selected: null as number | null };
      for (let k = 0; k < level.pieces.length; k++) {
        state = tapChip(state.slots, null, k, level);
        expect(state.slots[k].onBoard).toBe(true);
        expect(slotsLegal(level, state.slots)).toBe(true);
      }
    }
  });

  it('rotation skips angles that would clip the glass, and the slider ignores them', () => {
    // A bar just right of the glass: flat is fine, but tilting its left end down into the glass is not.
    const level: Level = crossfire;
    const slots: Slot[] = [{ len: 70, onBoard: true, x: g.r + 58, y: g.rim - 20, deg: 0 }, ...emptySlots(level).slice(1)];
    expect(slotsLegal(level, slots)).toBe(true);
    const turned = rotateLegal(level, slots, 0, -1);
    expect(slotsLegal(level, turned)).toBe(true);
    expect(shownAngle(turned[0].deg)).not.toBe(0);
    expect(illegalBars(level, rotateToLegal(level, slots, 0, 160))).toEqual([false]);
  });
});
