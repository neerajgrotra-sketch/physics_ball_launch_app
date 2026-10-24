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
  const dot = aimPreview(40, 60)[6];
  const grab = grabAimLine(dot, 40, 60)!;
  const r = Math.hypot(dot.x - LAUNCHER.x, dot.y - LAUNCHER.y);
  const b = Math.atan2(LAUNCHER.y - dot.y, dot.x - LAUNCHER.x);
  const polar = (rr: number, bb: number) => ({ x: LAUNCHER.x + rr * Math.cos(bb), y: LAUNCHER.y - rr * Math.sin(bb) });

  it('grabs the line without jumping', () => {
    expect(grab).not.toBeNull();
    expect(swingTo(dot, grab)).toEqual({ angle: 40, power: 60 });
  });

  it('swings the angle round the launcher, keeping power', () => {
    const a = swingTo(polar(r, b + (10 * Math.PI) / 180), grab);
    expect(a.angle).toBeCloseTo(50, 0);
    expect(a.power).toBeCloseTo(60, 0);
  });

  it('stretches for more power and shrinks for less, keeping the angle', () => {
    const out = swingTo(polar(r * 1.3, b), grab), back = swingTo(polar(r * 0.7, b), grab);
    expect(out.angle).toBe(40);
    expect(out.power).toBeGreaterThan(75);
    expect(back.power).toBeLessThan(45);
    expect(swingTo(polar(r * 5, b), grab).power).toBe(100);
    expect(swingTo(polar(1, b), grab).power).toBe(0);
  });

  it('ignores touches away from the line and clamps the angle to 0–90', () => {
    expect(grabAimLine({ x: 350, y: 100 }, 40, 60)).toBeNull();
    expect(swingTo(at(-100, 50), { ...grab, offset: 0 }).angle).toBe(90);
    expect(swingTo(at(100, -50), { ...grab, offset: 0 }).angle).toBe(0);
  });
});
