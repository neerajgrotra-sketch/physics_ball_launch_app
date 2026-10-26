import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels';
import { aimHintNotice, aimHintValue, aimHints } from './help';

describe('aim hints', () => {
  const level = LEVELS[1];
  const s = level.solution!;

  it('offers the angle and the power until the aim matches the answer', () => {
    expect(aimHints(level, 52, 45)).toEqual({ angle: true, power: true });
    expect(aimHints(level, s.angle, 45)).toEqual({ angle: false, power: true });
    expect(aimHints(level, s.angle, s.power)).toEqual({ angle: false, power: false });
    expect(aimHints({ ...level, solution: undefined }, 52, 45)).toEqual({ angle: false, power: false });
  });

  it('gives the stored answer\'s values, which every level has', () => {
    for (const l of LEVELS) {
      expect(aimHintValue(l, 'angle')).toBe(l.solution!.angle);
      expect(aimHintValue(l, 'power')).toBe(l.solution!.power);
    }
  });

  it('says what was set', () => {
    expect(aimHintNotice('angle', 35.8, 3)).toMatch(/^Angle set to 35\.8°.*all 3 bars/);
    expect(aimHintNotice('angle', 37.6, 2)).toContain('with both bars where the answer puts them');
    expect(aimHintNotice('power', 24, 1)).toMatch(/^Power set to 24\.0, as in the answer\. It lands with the bar/);
  });
});
