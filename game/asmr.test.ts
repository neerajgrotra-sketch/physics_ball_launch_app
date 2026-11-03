import { describe, expect, it } from 'vitest';
import { ASMR_SCALE, BLOCK_HIT, asmrRate, asmrStep, hitTarget } from './asmr';
import { LEVELS } from '../levels';

describe('ASMR bounce notes', () => {
  it('climbs the pentatonic scale, then comes back down', () => {
    const steps = Array.from({ length: 20 }, (_, n) => asmrStep(n));
    expect(steps.slice(0, 9)).toEqual([...ASMR_SCALE]);
    expect(steps.slice(8, 17)).toEqual([...ASMR_SCALE].reverse());
    expect(steps[17]).toBe(2);
    for (const s of steps) expect(ASMR_SCALE).toContain(s);
  });
  it('turns a step into a varispeed rate (an octave doubles it)', () => {
    expect(asmrRate(0)).toBe(1);
    expect(asmrRate(5)).toBeCloseTo(2);
  });
});

describe('ASMR hit targets', () => {
  const level = { ...LEVELS[0], blocks: [{ x: 100, y: 300, w: 40, h: 200 }, { x: 300, y: 300, w: 40, h: 200 }] };
  it('names the bar a hit struck, the nearest block, or nothing', () => {
    expect(hitTarget(level, { i: 0, kind: 'piece', piece: 2, speed: 1, counts: true }, [0, 0])).toBe(2);
    expect(hitTarget(level, { i: 0, kind: 'block', speed: 1, counts: true }, [129, 250])).toBe(BLOCK_HIT);
    expect(hitTarget(level, { i: 0, kind: 'block', speed: 1, counts: true }, [271, 250])).toBe(BLOCK_HIT + 1);
    expect(hitTarget(level, { i: 0, kind: 'wall', speed: 1, counts: true }, [0, 0])).toBe(-1);
    expect(hitTarget({ ...level, blocks: [] }, { i: 0, kind: 'block', speed: 1, counts: true }, [0, 0])).toBe(-1);
  });
});
