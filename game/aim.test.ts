import { describe, expect, it } from 'vitest';
import { LAUNCHER } from '../physics';
import { aimAt, aimPreview, grabAimLine, nearLauncher, nudgeAngle, nudgePower, swingTo, toGrid } from './aim';

const at = (dx: number, dy: number) => ({ x: LAUNCHER.x + dx, y: LAUNCHER.y - dy });

describe('aimAt', () => {
  it('points the way you drag', () => {
    expect(aimAt(at(100, 100)).angle).toBe(45);
    expect(aimAt(at(100, 0)).angle).toBe(0);
    expect(aimAt(at(0, 100)).angle).toBe(90);
  });

  it('maps distance to power, clamped to 0–100', () => {
    expect(aimAt(at(20, 0)).power).toBe(0);
    expect(aimAt(at(20 + 2.6 * 50, 0)).power).toBe(50);
    expect(aimAt(at(1000, 0)).power).toBe(100);
  });

  it('pins backward drags to the nearest legal angle', () => {
    expect(aimAt(at(-50, 30)).angle).toBe(90);
    expect(aimAt(at(-50, -30)).angle).toBe(0);
    expect(aimAt(at(50, -30)).angle).toBe(0);
  });

  it('only produces values on the 0.1 grid', () => {
    for (let i = 0; i < 200; i++) {
      const { angle, power } = aimAt(at(13 + i * 1.37, 7 + i * 0.91));
      expect(angle).toBe(toGrid(angle));
      expect(Math.round(angle * 10)).toBeCloseTo(angle * 10, 9);
      expect(Math.round(power * 10)).toBeCloseTo(power * 10, 9);
    }
  });
});

describe('nudge', () => {
  it('steps by 0.1 without float drift', () => {
    let a = 52;
    for (let i = 0; i < 7; i++) a = nudgeAngle(a, 1);
    expect(a).toBe(52.7);
    expect(nudgePower(45, -1)).toBe(44.9);
  });

  it('stays in range', () => {
    expect(nudgeAngle(90, 1)).toBe(90);
    expect(nudgeAngle(0, -1)).toBe(0);
    expect(nudgePower(100, 1)).toBe(100);
    expect(nudgePower(0, -1)).toBe(0);
  });
});

describe('nearLauncher', () => {
  it('grabs within 90 units of the launcher only', () => {
    expect(nearLauncher(at(60, 60))).toBe(true);
    expect(nearLauncher(at(90, 0))).toBe(false);
  });
});

describe('dragging the dotted aim line', () => {
  const dots = aimPreview(40, 60);
  const dot = dots[6];
  const grab = grabAimLine(dot, 40, 60)!;
  // Where the same dot would be for another aim: that's where the finger has to be.
  const dotFor = (a: number, p: number) => aimPreview(a, p)[6];

  it('grabs the nearest dot without jumping', () => {
    expect(grab).not.toBeNull();
    expect(grab.t).toBeCloseTo(dot.t, 9);
    expect(swingTo(dot, grab)).toEqual({ angle: 40, power: 60 });
    // A touch a little off the dot doesn't jump the aim either.
    const off = { x: dot.x + 8, y: dot.y - 5 };
    expect(swingTo(off, grabAimLine(off, 40, 60)!)).toEqual({ angle: 40, power: 60 });
  });

  it('turns the angle without drifting the power', () => {
    expect(swingTo(dotFor(50, 60), grab)).toEqual({ angle: 50, power: 60 });
    expect(swingTo(dotFor(15, 60), grab)).toEqual({ angle: 15, power: 60 });
  });

  it('stretches for more power and shrinks for less, keeping the angle', () => {
    expect(swingTo(dotFor(40, 85), grab)).toEqual({ angle: 40, power: 85 });
    expect(swingTo(dotFor(40, 30), grab)).toEqual({ angle: 40, power: 30 });
  });

  it('does both at once', () => {
    expect(swingTo(dotFor(63.3, 22.5), grab)).toEqual({ angle: 63.3, power: 22.5 });
  });

  it('ignores touches away from the line, and keeps angle in 0–90 and power in 0–100', () => {
    expect(grabAimLine({ x: 350, y: 100 }, 40, 60)).toBeNull();
    const g = { t: 0.27, ox: 0, oy: 0 };
    expect(swingTo(at(-100, 50), g).angle).toBe(90);
    expect(swingTo(at(-100, -50), g).angle).toBe(0);
    expect(swingTo(at(2000, 0), g).power).toBe(100);
    expect(swingTo(at(1, 0), g).power).toBe(0);
  });
});
