import { describe, expect, it } from 'vitest';
import { parseUnlocked, skipNotice, unlockAfterWin, winText, cardStates } from './progress';

describe('parseUnlocked', () => {
  it('reads a stored index and clamps it to the levels that exist', () => {
    expect(parseUnlocked('2', 5)).toBe(2);
    expect(parseUnlocked('9', 5)).toBe(4);
    expect(parseUnlocked('-3', 5)).toBe(0);
  });

  it('starts at the first level when nothing usable is stored', () => {
    expect(parseUnlocked(null, 5)).toBe(0);
    expect(parseUnlocked('', 5)).toBe(0);
    expect(parseUnlocked('banana', 5)).toBe(0);
  });
});

describe('unlockAfterWin', () => {
  it('unlocks the next level', () => {
    expect(unlockAfterWin(0, 0, 5)).toBe(1);
    expect(unlockAfterWin(3, 3, 5)).toBe(4);
  });

  it('never goes backwards or past the last level', () => {
    expect(unlockAfterWin(4, 1, 5)).toBe(4);
    expect(unlockAfterWin(4, 4, 5)).toBe(4);
  });
});

describe('winText', () => {
  const base = { assisted: null, tries: 3, bounces: 4, par: 3, last: false } as const;

  it('names the result against par, with stars and score', () => {
    expect(winText(base)).toMatchObject({ title: 'Bogey!', detail: '4 bounces, par 3 · 3 tries', stars: 2, score: 750, next: 'Get it in with 3 bounces or fewer for ★★★' });
    expect(winText({ ...base, bounces: 3, tries: 1 })).toMatchObject({ title: 'Par!', detail: '3 bounces, par 3 · first try', stars: 3, next: null });
    expect(winText({ ...base, bounces: 2 }).title).toBe('Birdie!');
    expect(winText({ ...base, bounces: 9 })).toMatchObject({ title: 'In the glass', stars: 1 });
    expect(winText(base)).toMatchObject({ again: 'Reset level', go: 'Next level' });
  });

  it('gives no stars or score with help', () => {
    expect(winText({ ...base, assisted: 'solve' })).toMatchObject({ title: 'Here’s one way in', again: 'Try it yourself', stars: 0, score: null });
    expect(winText({ ...base, assisted: 'hint' })).toMatchObject({ stars: 0, score: null, again: 'Reset level' });
  });

  it('offers to play the last level again', () => {
    expect(winText({ ...base, last: true }).go).toBe('Play again');
  });
});

describe('skipNotice', () => {
  it('asks for every bar to be placed', () => {
    expect(skipNotice(3, [1], [true])).toBe('In the glass, but it has to bounce off all 3 bars. Place all 3 bars first.');
    expect(skipNotice(1, [], [])).toBe('In the glass, but it has to bounce off the bar. Place the bar first.');
  });

  it('names the bars the ball missed', () => {
    expect(skipNotice(3, [1, 2, 3], [true, false, true])).toBe('In the glass, but it missed Bar 2. It has to bounce off all 3 bars.');
    expect(skipNotice(3, [1, 2, 3], [false, true, false])).toBe('In the glass, but it missed Bars 1 and 3. It has to bounce off all 3 bars.');
    expect(skipNotice(2, [1, 2], [false, false])).toBe('In the glass, but it missed Bars 1 and 2. It has to bounce off both bars.');
  });
});

describe('skipNotice with spring pads', () => {
  it('names a missed pad when every bar was hit', () => {
    expect(skipNotice(2, [1, 2], [true, true], { pads: { total: 1, touched: [false] } }))
      .toBe('In the glass, but it never touched the spring pad. It has to bounce off the spring pad as well as both bars.');
  });
  it('adds the pad to the bar message', () => {
    expect(skipNotice(2, [1, 2], [true, false], { pads: { total: 2, touched: [true, true] } }))
      .toBe('In the glass, but it missed Bar 2. It has to bounce off both bars and both spring pads.');
  });
});

describe('cardStates', () => {
  const ids = ['tut', 'a', 'b', 'c', 'd'];
  it('shows a level won with help as won, and the level it unlocked as the next to play, not locked', () => {
    // Tutorial done, a won with stars, b won with Solve (no stars): c is unlocked and next.
    expect(cardStates(ids, (id) => id === 'a', 3, 3, true)).toEqual(['won', 'won', 'helped', 'next', 'locked']);
  });
  it('shows levels opened by the Testing switch as open, not locked', () => {
    expect(cardStates(ids, (id) => id === 'a', 2, 4, true)).toEqual(['won', 'won', 'next', 'open', 'open']);
  });
  it('starts a new player on the tutorial', () => {
    expect(cardStates(ids, () => false, 0, 0, false)).toEqual(['next', 'locked', 'locked', 'locked', 'locked']);
  });
  it('has no next level once the last is won', () => {
    expect(cardStates(ids, () => true, 4, 4, true)).not.toContain('next');
  });
});

describe('winText with help', () => {
  it('scores a level won after a hint, capped, and says so', () => {
    const t = winText({ assisted: null, tries: 2, bounces: 3, par: 3, last: false, help: 1 });
    expect(t.stars).toBe(2);
    expect(t.score).toBeGreaterThan(0);
    expect(t.detail).toContain('solved with help, max ★★');
    expect(t.next).toBeNull();
  });
  it('gives the Solve button’s own shot one star on a level', () => {
    const t = winText({ assisted: 'solve', tries: 1, bounces: 3, par: 3, last: false, help: 2 });
    expect(t.stars).toBe(1);
    expect(t.again).toBe('Try it yourself');
  });
  it('keeps the daily rule: a helped daily win has no stars', () => {
    expect(winText({ assisted: 'hint', tries: 1, bounces: 3, par: 3, last: false }).stars).toBe(0);
    expect(winText({ assisted: 'solve', tries: 1, bounces: 3, par: 3, last: false }).stars).toBe(0);
  });
});
