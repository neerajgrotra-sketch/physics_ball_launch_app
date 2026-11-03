import { describe, expect, it } from 'vitest';
import { parseTurn, trackForTurn } from './musicTurn';

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
