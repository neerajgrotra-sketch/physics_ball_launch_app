import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels';
import { emptySlots, solutionSlots } from './pieces';
import { degDiff, ghostFor, snapAim, snapBar, tutorialState, SNAP_DEG, SNAP_POS } from './tutorial';

const level = LEVELS.find((l) => l.pieces.length === 3)!;
const sol = level.solution!;
const placed = emptySlots(level).map((s) => ({ ...s, onBoard: true }));

describe('tutorial snapping', () => {
  it('measures rotation as lines, so 180° apart is the same', () => {
    expect(degDiff(10, 190)).toBe(0);
    expect(degDiff(-170, 10)).toBe(0);
    expect(degDiff(0, 90)).toBe(90);
    expect(degDiff(5, -5)).toBe(10);
  });

  it('snaps a bar onto its spot only when close', () => {
    const near = placed.map((s, k) => (k === 0 ? { ...s, x: sol.pieces[0].x + SNAP_POS - 6, y: sol.pieces[0].y } : s));
    const far = placed.map((s, k) => (k === 0 ? { ...s, x: sol.pieces[0].x + SNAP_POS + 6, y: sol.pieces[0].y } : s));
    expect(snapBar(level, near, 0, 'pos')[0]).toMatchObject({ x: sol.pieces[0].x, y: sol.pieces[0].y });
    expect(snapBar(level, far, 0, 'pos')).toBe(far);
    expect(snapBar(level, near, 0, 'deg')).toBe(near); // position snap doesn't turn it
  });

  it('snaps a bar\'s rotation when close', () => {
    const turned = placed.map((s, k) => (k === 1 ? { ...s, deg: sol.pieces[1].deg + SNAP_DEG - 3 } : s));
    expect(snapBar(level, turned, 1, 'deg')[1].deg).toBe(sol.pieces[1].deg);
    const off = placed.map((s, k) => (k === 1 ? { ...s, deg: sol.pieces[1].deg + SNAP_DEG + 3 } : s));
    expect(snapBar(level, off, 1, 'deg')).toBe(off);
  });

  it('snaps angle and power independently', () => {
    expect(snapAim(level, sol.angle + 1, sol.power + 20)).toEqual({ angle: sol.angle, power: sol.power + 20 });
    expect(snapAim(level, sol.angle + 9, sol.power - 3)).toEqual({ angle: sol.angle + 9, power: sol.power });
  });

  it('reads the setup against the solution, and ghosts show each bar\'s spot', () => {
    const t = tutorialState(level, solutionSlots(level), null, sol.angle, sol.power);
    expect(t.posOk).toEqual([true, true, true]);
    expect(t.degOk).toEqual([true, true, true]);
    expect(t.angleOk && t.powerOk).toBe(true);
    expect(tutorialState(level, placed, null, 52, 45).posOk).toEqual([false, false, false]);
    expect(ghostFor(level, 2)).toMatchObject({ ...sol.pieces[2], len: level.pieces[2].len });
  });
});
