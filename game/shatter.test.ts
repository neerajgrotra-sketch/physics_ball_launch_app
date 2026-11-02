import { describe, expect, it } from 'vitest';
import { SHATTER_TIME, landTime, shardAt, shatterClock, shatterPieces } from './shatter';

describe('ball shatter', () => {
  it('is the same every time for the same death', () => {
    expect(shatterPieces(120, 300, 400, -200, 535)).toEqual(shatterPieces(120, 300, 400, -200, 535));
    expect(shatterPieces(120, 300, 400, -200, 535)).not.toEqual(shatterPieces(121, 300, 400, -200, 535));
  });

  it('bursts all the way round, carrying on with the ball', () => {
    const { shards } = shatterPieces(200, 300, 600, 0, 535);
    expect(shards.length).toBe(22);
    const meanVx = shards.reduce((s, p) => s + p.vx, 0) / shards.length;
    expect(meanVx).toBeGreaterThan(60); // momentum to the right
    expect(shards.some((p) => p.vx < 0)).toBe(true); // but some fly back
  });

  it('lands shards on the floor and keeps them there', () => {
    const floor = 535;
    for (const s of shatterPieces(200, 450, 0, 300, floor).shards) {
      const end = shardAt(s, 200, 450, SHATTER_TIME, floor);
      expect(end.y).toBeLessThanOrEqual(floor);
      if (Number.isFinite(s.land)) {
        expect(end.y).toBe(floor);
        expect(shardAt(s, 200, 450, SHATTER_TIME, floor).rot).toBe(shardAt(s, 200, 450, s.land, floor).rot);
      }
    }
    expect(landTime(600, 0, 535)).toBe(0);
  });

  it('runs its clock from 0 to SHATTER_TIME, fast first then slow', () => {
    expect(shatterClock(0)).toBe(0);
    expect(shatterClock(1)).toBeCloseTo(SHATTER_TIME);
    expect(shatterClock(0.1)).toBeGreaterThan(shatterClock(0.9) - shatterClock(0.8));
  });
});
