import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels';
import type { Level } from '../physics';
import { boardBoxes, counterSpot } from './counter';

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
