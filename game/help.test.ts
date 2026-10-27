import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels';
import { aimHintNotice, hintLabel, nextHint, solvedNudge, stepsLeft } from './help';

describe('the hint sequence', () => {
  const level = LEVELS[2];
  const s = level.solution!;

  it('gives the bars first, in order', () => {
    expect(nextHint(level, 0, 52, 45)).toEqual({ kind: 'bar', bar: 1 });
    expect(nextHint(level, 1, s.angle, s.power)).toEqual({ kind: 'bar', bar: 2 });
  });

  it('then the angle, then the power, skipping what already matches', () => {
    expect(nextHint(level, null, 52, 45)).toEqual({ kind: 'angle', value: s.angle });
    expect(nextHint(level, null, s.angle, 45)).toEqual({ kind: 'power', value: s.power });
    expect(nextHint(level, null, 52, s.power)).toEqual({ kind: 'angle', value: s.angle });
    expect(nextHint(level, null, s.angle, s.power)).toBeNull();
    expect(nextHint({ ...level, solution: undefined }, 0, 52, 45)).toBeNull();
  });

  it('labels the button and says what an aim hint set', () => {
    expect(hintLabel({ kind: 'bar', bar: 2 })).toBe('Hint: place Bar 2');
    expect(hintLabel({ kind: 'angle', value: 37.6 })).toBe('Hint: launch angle');
    expect(hintLabel({ kind: 'power', value: 55.1 })).toBe('Hint: launch power');
    expect(aimHintNotice({ kind: 'angle', value: 37.6 })).toBe('Angle set to 37.6°, as in the answer.');
    expect(aimHintNotice({ kind: 'bar', bar: 1 })).toBeNull();
  });

  it('says the answer is already there instead of offering more help', () => {
    expect(solvedNudge(false)).toMatch(/already set up.*launch/i);
    expect(solvedNudge(true)).toMatch(/Replay/);
  });

  it('counts the steps still missing', () => {
    expect(stepsLeft(level, 2, 52, 45)).toBe(4);
    expect(stepsLeft(level, 0, s.angle, 45)).toBe(1);
    expect(stepsLeft(level, 0, s.angle, s.power)).toBe(0);
  });
});
