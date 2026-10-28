import { describe, expect, it } from 'vitest';
import { LAUNCHER } from '../physics';
import { DEFAULT_GUN, GUNS, gunShapes, parseGun, type GunShape } from './guns';

const c = { ink: '#2c3133', muted: '#78837d', paper: '#e9eee3' };
const points = (s: GunShape) => (s.kind === 'poly' ? s.points : s.kind === 'line' ? [s.from, s.to] : [s.at]);

describe('gun skins', () => {
  it('saves by id, and anything unknown is the classic gun', () => {
    expect(new Set(GUNS.map((g) => g.id)).size).toBe(GUNS.length);
    expect(parseGun('pirate').name).toBe('Pirate cannon');
    expect(parseGun('nope')).toBe(DEFAULT_GUN);
    expect(parseGun(null).id).toBe('classic');
  });

  it('every gun draws, at every aim, close round the launcher', () => {
    for (const g of GUNS) {
      for (const angle of [0, 30, 52, 90]) {
        for (const power of [0, 50, 100]) {
          const shapes = gunShapes(g, angle, power, c);
          expect(shapes.length, g.id).toBeGreaterThan(0);
          for (const [x, y] of shapes.flatMap(points)) {
            expect(Number.isFinite(x) && Number.isFinite(y), g.id).toBe(true);
            expect(Math.hypot(x - LAUNCHER.x, y - LAUNCHER.y), `${g.id} ${angle}° ${power}`).toBeLessThan(110);
          }
        }
      }
    }
  });

  it('the barrel turns with the aim', () => {
    const tip = (angle: number) => {
      const line = gunShapes(DEFAULT_GUN, angle, 45, c).find((s) => s.kind === 'line');
      return line && line.kind === 'line' ? line.to : null;
    };
    expect(tip(0)![1]).toBeCloseTo(LAUNCHER.y, 5); // flat
    expect(tip(90)![0]).toBeCloseTo(LAUNCHER.x, 5); // straight up
  });

  it('the slingshot and the cue draw back further for more power', () => {
    const reach = (id: string, power: number) => Math.max(...gunShapes(parseGun(id), 45, power, c).flatMap(points)
      .map(([x, y]) => Math.hypot(x - LAUNCHER.x, y - LAUNCHER.y)));
    expect(reach('cue', 100)).toBeGreaterThan(reach('cue', 0) + 10);
    const pouch = (power: number) => {
      const s = gunShapes(parseGun('slingshot'), 45, power, c).at(-1)!;
      return s.kind === 'circle' ? Math.hypot(s.at[0] - LAUNCHER.x, s.at[1] - LAUNCHER.y) : 0;
    };
    expect(pouch(100)).toBeGreaterThan(pouch(0) + 10);
  });
});
