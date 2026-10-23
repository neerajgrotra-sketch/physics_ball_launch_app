import { describe, expect, it } from 'vitest';
import { LAUNCHER } from '../physics';
import { aimAt, nearLauncher, nudgeAngle, nudgePower, toGrid } from './aim';

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
