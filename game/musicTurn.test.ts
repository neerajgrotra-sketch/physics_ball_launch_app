import { describe, expect, it } from 'vitest';
import { parseTurn, trackForTurn } from './musicTurn';
import { mixStepFor } from './musicTurn';

describe('music turns', () => {
  it('reads the stored turn, starting at 0', () => {
    expect(parseTurn(null)).toBe(0);
    expect(parseTurn('3')).toBe(3);
    expect(parseTurn('junk')).toBe(0);
    expect(parseTurn('-1')).toBe(0);
  });
  it('plays each track in turn, a different one every session', () => {
    const two = ['neon', 'felt'];
    expect([0, 1, 2, 3].map((t) => trackForTurn(two, t))).toEqual(['neon', 'felt', 'neon', 'felt']);
    expect(trackForTurn(['only'], 5)).toBe('only');
    expect(trackForTurn([], 1)).toBeUndefined();
  });
});

describe('Mix moves on at each new level', () => {
  it('keeps the first level on the track already playing, then moves on at each different level', () => {
    let m = { step: 0, last: null as string | null };
    const open = (id: string) => { m = mixStepFor(m.step, m.last, id); return m.step; };
    expect(open('levels')).toBe(0);
    expect(open('02-two-step')).toBe(0); // the first level: the levels screen's track carries on
    expect(open('02-two-step')).toBe(0); // the same level again (back from Settings)
    expect(open('levels')).toBe(0);      // the list never moves it
    expect(open('03-four-mm')).toBe(1);
    expect(open('04-next')).toBe(2);
  });
});
