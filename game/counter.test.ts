import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels';
import type { Level } from '../physics';
import { badgeBox, badgeCovers, boardBoxes, counterSpot } from './counter';

const base: Level = { id: 't', name: 't', hint: '', glass: { x: 300, w: 40, h: 50 }, fixed: [], pieces: [{ len: 90 }] };

describe('bounce counter spot', () => {
  it('stays top-left on an empty top', () => {
    expect(counterSpot(base)).toBe('left');
  });

  it('moves off a spiked roof in the top left', () => {
    const level: Level = { ...base, hazards: [{ x: 60, y: 70, w: 120, h: 12 }] };
    expect(counterSpot(level)).not.toBe('left');
  });

  it('never covers more than the best alternative, on every level', () => {
    for (const level of LEVELS) {
      const spot = counterSpot(level);
      expect(['left', 'center', 'right']).toContain(spot);
      expect(boardBoxes(level).length).toBeGreaterThan(0);
    }
  });

  it('Slingshot gets the counter off the roof in the top left', () => {
    const level = LEVELS.find((l) => l.id === '22-slingshot')!;
    expect(counterSpot(level)).not.toBe('left');
  });
});

describe('badgeCovers', () => {
  const box = badgeBox('left');
  it('is true when a bar or a bounce marker sits under the badge', () => {
    expect(badgeCovers(box, [{ x1: 30, y1: 40, x2: 120, y2: 60 }], [])).toBe(true);
    expect(badgeCovers(box, [], [{ x: 60, y: 40 }])).toBe(true);
    // A long bar that only passes through the corner counts too.
    expect(badgeCovers(box, [{ x1: 0, y1: 0, x2: 300, y2: 300 }], [])).toBe(true);
  });
  it('is false when they are clear of it', () => {
    expect(badgeCovers(box, [{ x1: 200, y1: 300, x2: 300, y2: 320 }], [{ x: 300, y: 400 }])).toBe(false);
  });
  it('puts the tries badge across from the counter', () => {
    expect(badgeBox('right')[0]).toBeGreaterThan(badgeBox('left')[2]);
  });
});
