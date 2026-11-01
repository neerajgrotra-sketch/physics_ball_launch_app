import { describe, expect, it } from 'vitest';
import { ASMR_SCALE, asmrRate, asmrStep } from './asmr';

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
