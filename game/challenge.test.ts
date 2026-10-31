import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels';
import { challengeBounces, challengeQuery, challengeUrl, challengeWinText, decodeShot, encodeShot, readChallenge } from './challenge';

const level = LEVELS.find((l) => l.solution && l.pieces.length >= 2)!;
const shot = { pieces: level.solution!.pieces, angle: level.solution!.angle, power: level.solution!.power };
const params = (q: string) => Object.fromEntries(new URLSearchParams(q));

describe('challenge links', () => {
  it('carry a shot there and back exactly', () => {
    expect(decodeShot(encodeShot(shot))).toEqual(shot);
  });

  it("don't spell out where the bars go", () => {
    const code = encodeShot(shot);
    expect(code).not.toContain(String(shot.pieces[0].x));
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('open the right level with the sender’s name, and re-run to the stored answer’s bounces', () => {
    const url = challengeUrl({ levelId: level.id, from: 'Neeraj', shot }, 'https://example.com/');
    expect(url.startsWith('https://example.com/challenge?')).toBe(true);
    const c = readChallenge(params(url.split('?')[1]));
    expect(c?.level.id).toBe(level.id);
    expect(c?.from).toBe('Neeraj');
    expect(challengeBounces(level, c!.shot)).toBe(level.par);
  });

  it('every level’s stored answer works as a challenge', () => {
    for (const l of LEVELS) {
      if (!l.solution) continue;
      const s = { pieces: l.solution.pieces, angle: l.solution.angle, power: l.solution.power };
      const c = readChallenge(params(challengeQuery({ levelId: l.id, from: '', shot: s })));
      expect(c && challengeBounces(l, c.shot)).toBe(l.par);
    }
  });

  it('reject broken or edited links', () => {
    expect(readChallenge({ l: 'nope', s: encodeShot(shot) })).toBeNull();
    expect(readChallenge({ l: level.id, s: 'garbage!' })).toBeNull();
    expect(readChallenge({ l: level.id })).toBeNull();
    // A shot for the wrong number of bars.
    expect(readChallenge({ l: level.id, s: encodeShot({ ...shot, pieces: shot.pieces.slice(1) }) })).toBeNull();
    // A shot that doesn't win is caught by re-running it.
    expect(challengeBounces(level, { ...shot, angle: 5, power: 5 })).toBeNull();
  });

  it('say how the friend did', () => {
    expect(challengeWinText(2, 3, 'Neeraj').title).toBe('You beat Neeraj!');
    expect(challengeWinText(3, 3, '').title).toBe('Tied with your friend!');
    expect(challengeWinText(5, 3, 'Neeraj').detail).toContain('You 5 · Neeraj 3 bounces');
    expect(challengeWinText(2, 3, 'Neeraj', true).detail).toContain('You 2 (with help)');
  });
});
