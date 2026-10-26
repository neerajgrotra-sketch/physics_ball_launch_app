import { describe, expect, it } from 'vitest';
import { burstFor, confettiPieces, fuseGeometry } from './celebration';

describe('celebration', () => {
  it('bursts bigger for a better result, and small after a hint or Solve', () => {
    expect(burstFor(3, false).confetti).toBeGreaterThan(burstFor(2, false).confetti);
    expect(burstFor(2, false).confetti).toBeGreaterThan(burstFor(1, false).confetti);
    expect(burstFor(3, false).rings).toBe(2);
    expect(burstFor(3, true).confetti).toBeLessThan(burstFor(1, false).confetti);
  });

  it('gives the spark a path that runs from 0 to 1 and never goes back', () => {
    const g = fuseGeometry([[0, 0], [30, 40], [30, 40 + 50]]);
    expect(g.cum[0]).toBe(0);
    expect(g.cum[g.cum.length - 1]).toBe(1);
    for (let i = 1; i < g.cum.length; i++) expect(g.cum[i]).toBeGreaterThanOrEqual(g.cum[i - 1]);
    expect(g.flat).toEqual([0, 0, 30, 40, 30, 90]);
  });

  it('lets the spark hop across a portal without spending any of its time', () => {
    const g = fuseGeometry([[0, 0], [0, 100], [300, 300], [300, 400]], [2]);
    expect(g.cum[2]).toBe(g.cum[1]);  // the jump adds no distance
    expect(g.cum[1]).toBeCloseTo(0.5, 5);
  });

  it('makes the same confetti every time, flying upward', () => {
    expect(confettiPieces(20)).toEqual(confettiPieces(20));
    for (const p of confettiPieces(34)) {
      expect(Math.sin(p.angle)).toBeLessThan(0); // up the screen
      expect(p.speed).toBeGreaterThan(100);
    }
  });
});
