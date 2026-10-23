import { describe, expect, it } from 'vitest';
import { parseUnlocked, skipNotice, unlockAfterWin, winText } from './progress';

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
  const base = { solved: false, tries: 3, angle: 45.5, power: 68.8, last: false };

  it('counts tries', () => {
    expect(winText(base).title).toBe('In the glass in 3 tries');
    expect(winText({ ...base, tries: 1 }).title).toBe('In the glass on the first try');
    expect(winText(base).detail).toBe('Angle 45.5°, power 68.8');
    expect(winText(base)).toMatchObject({ again: 'Replay level', go: 'Next level' });
  });

  it('reads differently after Solve', () => {
    expect(winText({ ...base, solved: true })).toMatchObject({ title: 'Here’s one way in', again: 'Try it yourself' });
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
