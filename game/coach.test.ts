import { describe, expect, it } from 'vitest';
import { coachStep, coachText } from './coach';

describe('idle coach', () => {
  it('suggests placing, then dragging, then launching', () => {
    expect(coachStep([false, false, false], false)).toEqual({ kind: 'place', bar: 0 });
    expect(coachStep([true, false, true], false)).toEqual({ kind: 'place', bar: 1 });
    expect(coachStep([true, true], false)).toEqual({ kind: 'drag', bar: 0 });
    expect(coachStep([true, true], true)).toEqual({ kind: 'launch' });
    expect(coachStep([], false)).toEqual({ kind: 'launch' });
  });

  it('says what to do', () => {
    expect(coachText({ kind: 'place', bar: 1 })).toBe('Tap Bar 2 to put it on the board');
    expect(coachText({ kind: 'launch' })).toBe('Tap Launch to fire');
  });
});
