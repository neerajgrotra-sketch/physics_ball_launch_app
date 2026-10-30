import { describe, expect, it } from 'vitest';
import { AFTER_SOLUTION, afterHint, bestOf, better, goalText, golfName, nextStarsText, parseBest, parseHelp, scoreFor, starCap, starsFor, totalScore } from './score';

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

  it('says what earns more stars', () => {
    expect(nextStarsText(6, 3)).toBe('Get it in with 5 bounces or fewer for ★★, or 3 for ★★★');
    expect(nextStarsText(4, 3)).toBe('Get it in with 3 bounces or fewer for ★★★');
    expect(nextStarsText(2, 1)).toBe('Get it in with 1 bounce or fewer for ★★★');
    expect(nextStarsText(3, 3)).toBeNull();
  });

  it('says the goal in words', () => {
    expect(goalText(3, 3)).toBe('Goal: into the glass in 3 bounces, off all 3 bars');
    expect(goalText(1, 1)).toBe('Goal: into the glass in 1 bounce, off the bar');
    expect(goalText(2, undefined)).toBe('Goal: off both bars, then into the glass');
  });
});

describe('goalText with spring pads', () => {
  it('adds the pads to the goal', () => {
    expect(goalText(2, 6, 2)).toBe('Goal: into the glass in 6 bounces, off both bars and both spring pads');
    expect(goalText(2, 4, 1)).toBe('Goal: into the glass in 4 bounces, off both bars and the spring pad');
  });
});

describe('goalText with portals', () => {
  it('adds the portal to the goal', () => {
    expect(goalText(2, 3, 0, 1)).toBe('Goal: into the glass in 3 bounces, off both bars and through the portal');
    expect(goalText(2, 3, 1, 1)).toBe('Goal: into the glass in 3 bounces, off both bars and the spring pad and through the portal');
  });
});

describe('help cap', () => {
  it('caps a helped win at ★★ after one hint and ★ after more help, never above what the shot earned', () => {
    expect(bestOf({ bounces: 3, par: 3, tries: 1 }).stars).toBe(3);
    expect(bestOf({ bounces: 3, par: 3, tries: 1 }, 1).stars).toBe(2);
    expect(bestOf({ bounces: 3, par: 3, tries: 1 }, 2).stars).toBe(1);
    // A shot that only earns ★ stays at ★ whatever the cap.
    expect(bestOf({ bounces: 9, par: 3, tries: 1 }, 1).stars).toBe(1);
    // The real bounce count is kept; only stars and points are capped.
    expect(bestOf({ bounces: 3, par: 3, tries: 1 }, 2).bounces).toBe(3);
  });

  it('gives fewer points with more help, and points never beat an unhelped win', () => {
    const clean = bestOf({ bounces: 3, par: 3, tries: 1 }).score;
    const oneHint = bestOf({ bounces: 3, par: 3, tries: 1 }, 1).score;
    const solved = bestOf({ bounces: 3, par: 3, tries: 1 }, 2).score;
    expect(clean).toBeGreaterThan(oneHint);
    expect(oneHint).toBeGreaterThan(solved);
    expect(solved).toBeGreaterThan(0);
  });

  it('only ever adds help, up to the solution level', () => {
    expect(afterHint(0)).toBe(1);
    expect(afterHint(1)).toBe(2);
    expect(afterHint(2)).toBe(2);
    expect(starCap(0)).toBe(3);
    expect(starCap(AFTER_SOLUTION)).toBe(1);
  });

  it('reads the stored help record safely', () => {
    expect(parseHelp(JSON.stringify({ a: 1, b: 2, c: 7, d: 0, e: 'x' }))).toEqual({ a: 1, b: 2, c: 2 });
    expect(parseHelp('nope')).toEqual({});
  });
});
