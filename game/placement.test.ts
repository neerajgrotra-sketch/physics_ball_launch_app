import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels';
import { glassBox, solutionPieces, type Level } from '../physics';
import { emptySlots, illegalBars, rotateLegal, rotateToLegal, shownAngle, slotsLegal, tapChip, turnBlockage, type Slot } from './pieces';
import { jamText } from './jam';
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

  it('rotation never turns a bar into the glass, and the slider ignores those angles', () => {
    // A bar just right of the glass: flat is fine, but tilting its left end down into the glass is not.
    const level: Level = crossfire;
    const slots: Slot[] = [{ len: 70, onBoard: true, x: g.r + 58, y: g.rim - 20, deg: 0 }, ...emptySlots(level).slice(1)];
    expect(slotsLegal(level, slots)).toBe(true);
    for (const by of [1, -1] as const) {
      const turned = rotateLegal(level, slots, 0, by);
      expect(slotsLegal(level, turned)).toBe(true);
      // One degree or nothing: it never leaps round to some far angle that happens to fit.
      if (turned !== slots) expect([1, 179]).toContain(shownAngle(turned[0].deg));
    }
    expect(illegalBars(level, rotateToLegal(level, slots, 0, 160))).toEqual([false]);
  });

  it('a jammed bar stays put on −/+, and says what is in the way', () => {
    // The phone report: Bar 2 upright beside the glass, pressing − (towards the glass) jumped it from 107° to 46°.
    const level: Level = crossfire;
    const slots: Slot[] = [{ len: 70, onBoard: true, x: g.r + 22, y: g.rim - 40, deg: -90 }, ...emptySlots(level).slice(1)];
    expect(slotsLegal(level, slots)).toBe(true);
    let s = slots, dir: 1 | -1 = 1;
    // Find the way that bumps the glass within a few degrees.
    const tryWay = (d: 1 | -1) => { let x = slots; for (let n = 0; n < 60; n++) { const y = rotateLegal(level, x, 0, d); if (y === x) return { x, n }; x = y; } return null; };
    const jam = tryWay(1) ?? tryWay(-1);
    expect(jam).not.toBeNull();
    s = jam!.x; dir = tryWay(1) ? 1 : -1;
    expect(rotateLegal(level, s, 0, dir)).toBe(s);
    const b = turnBlockage(level, s, 0, shownAngle(s[0].deg) + dir);
    expect(b?.blocker.what).toBe('glass');
    expect(turnBlockage(level, s, 0, shownAngle(s[0].deg))).toBeNull();
  });

  it('names the other bar when two bars jam', () => {
    const level: Level = crossfire;
    const base = emptySlots(level);
    const slots: Slot[] = base.map((sl, k) => (k === 0 ? { ...sl, onBoard: true, x: 120, y: 120, deg: 0 } : k === 1 ? { ...sl, onBoard: true, x: 120, y: 160, deg: 0 } : sl));
    expect(slotsLegal(level, slots)).toBe(true);
    // Turning bar 2 upright swings it into bar 1.
    expect(turnBlockage(level, slots, 1, 90)?.blocker).toEqual({ what: 'bar', other: 1 });
  });
});

describe('jam message', () => {
  it('says what bumps what and how to make room', () => {
    expect(jamText(2, { what: 'glass' })).toBe('Clunk! Bar 2 bumps the glass. Slide it clear to turn it further.');
    expect(jamText(1, { what: 'bar', other: 2 }, '+')).toBe('Clunk! Bar 1 bumps Bar 2. Move one of them to make room. It still turns the other way (+).');
    expect(jamText(3, { what: 'spikes' })).toMatch(/^Careful! Bar 3 would touch the spikes\./);
    expect(jamText(1, { what: 'floor' })).toContain('Lift it up');
  });
});
