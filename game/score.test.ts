import { describe, expect, it } from 'vitest';
import { better, golfName, goalText, parseBest, scoreFor, starsFor, totalScore } from './score';

describe('golf scoring', () => {
  it('names a shot against par', () => {
    expect(golfName(1, 3)).toBe('Eagle');
    expect(golfName(2, 3)).toBe('Birdie');
    expect(golfName(3, 3)).toBe('Par');
    expect(golfName(4, 3)).toBe('Bogey');
    expect(golfName(5, 3)).toBe('Double bogey');
    expect(golfName(7, 3)).toBe('+4');
  });

  it('stars: 3 at par or better, 2 within two, else 1', () => {
    expect(starsFor(2, 3)).toBe(3);
    expect(starsFor(3, 3)).toBe(3);
    expect(starsFor(5, 3)).toBe(2);
    expect(starsFor(6, 3)).toBe(1);
  });

  it('scores fewer bounces and fewer tries higher', () => {
    expect(scoreFor({ bounces: 3, par: 3, tries: 1 })).toBe(1000);
    expect(scoreFor({ bounces: 2, par: 3, tries: 4 })).toBe(1000);
    expect(scoreFor({ bounces: 5, par: 3, tries: 2 })).toBe(700);
    expect(scoreFor({ bounces: 12, par: 3, tries: 9 })).toBe(500);
  });

  it('keeps the better result and survives bad storage', () => {
    const a = { stars: 2, score: 700, bounces: 5 }, b = { stars: 3, score: 900, bounces: 3 };
    expect(better(a, b)).toBe(b);
    expect(better(b, a)).toBe(b);
    expect(better(undefined, a)).toBe(a);
    expect(parseBest('nonsense')).toEqual({});
    expect(parseBest(JSON.stringify({ x: a, y: { stars: 'x' } }))).toEqual({ x: a });
    expect(totalScore({ x: a, y: b })).toBe(1600);
  });

  it('says the goal in words', () => {
    expect(goalText(1, 2)).toBe('Par 2: bounce off the bar, then into the glass');
    expect(goalText(3, undefined)).toBe('bounce off all 3 bars, then into the glass');
  });
});
