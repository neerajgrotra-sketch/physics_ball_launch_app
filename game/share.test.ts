import { describe, expect, it } from 'vitest';
import { SHARE_LINK, resultLine, shareCard, shareMessage } from './share';

const level = { kind: 'level' as const, number: 7, name: 'Four millimetres' };

describe('share message', () => {
  it('names the level and the result, dares a friend and links the game', () => {
    const m = shareMessage(level, { bounces: 4, stars: 2, tries: 8, helped: false }, 2);
    expect(m).toContain('Level 7 · “Four millimetres” in Bank Shot');
    expect(m).toContain('★★☆ · 4 bounces (par 2) · 8 tries');
    expect(m).toContain(SHARE_LINK);
    expect(m).toContain("I'm playing the coolest game");
    expect(m).not.toContain('🎱'); // no cue ball: it isn't one of the game's balls
    expect(m.split('\n')[0]).toMatch(/eventually|not pretty/i);
  });

  it('brags more for better shots, and owns up to help', () => {
    expect(shareMessage(level, { bounces: 1, stars: 3, tries: 3, helped: false }, 3)).toMatch(/^🤯 EAGLE! 2 under par/);
    expect(shareMessage(level, { bounces: 2, stars: 3, tries: 1, helped: false }, 3)).toMatch(/^🐦 Birdie/);
    expect(shareMessage(level, { bounces: 3, stars: 3, tries: 1, helped: false }, 3)).toMatch(/^🎯/);
    expect(shareMessage(level, { bounces: 9, stars: 1, tries: 2, helped: false }, 3)).toMatch(/^(🙈|🫣)/);
    expect(shareMessage(level, { bounces: 3, stars: 0, tries: 1, helped: true }, 3)).toMatch(/^💡/);
  });

  it('is the same every time for the same win', () => {
    const r = { bounces: 3, stars: 3, tries: 4, helped: false };
    expect(shareMessage(level, r, 3)).toBe(shareMessage(level, r, 3));
  });

  it('daily: the puzzle number and streak, no level number', () => {
    const m = shareMessage({ kind: 'daily', number: 2, name: 'Ricochet', streak: 5 }, { bounces: 2, stars: 3, tries: 1, helped: false }, 2);
    expect(m).toContain('Bank Shot Daily #2 · “Ricochet”');
    expect(m).toContain('🔥 5-day streak');
    expect(m).toMatch(/today/);
    expect(resultLine({ bounces: 1, stars: 3, tries: 1, helped: false }, 1)).toBe('★★★ · 1 bounce (par 1) · 1 try');
  });
});

describe('share picture banner', () => {
  it('reads like a level complete screen', () => {
    expect(shareCard(level, { bounces: 4, stars: 2, tries: 8, helped: false }, 2))
      .toEqual({ title: 'LEVEL 7 COMPLETE!', stars: 2, line: '“Four millimetres” · Double bogey · 4 bounces (par 2) · 8 tries' });
    expect(shareCard(level, { bounces: 2, stars: 3, tries: 1, helped: false }, 2).line).toBe('“Four millimetres” · 2 bounces (par 2) · first try');
    expect(shareCard({ kind: 'daily', number: 2, name: 'Ricochet', streak: 1 }, { bounces: 1, stars: 3, tries: 1, helped: true }, 1))
      .toEqual({ title: 'DAILY #2 COMPLETE!', stars: null, line: '“Ricochet” · 1 bounce (par 1) · first try' });
  });
});
