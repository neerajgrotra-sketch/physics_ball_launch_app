import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels';
import { WORLDS, WORLD_ORDER, worldStartingAt } from './worlds';

describe('worlds', () => {
  it('list every level exactly once, in the order the game plays them', () => {
    expect(WORLD_ORDER).toEqual(LEVELS.map((l) => l.id));
    expect(new Set(WORLD_ORDER).size).toBe(WORLD_ORDER.length);
  });

  it('start each world with its own header', () => {
    for (const w of WORLDS) expect(worldStartingAt(w.ids[0])).toBe(w);
    expect(worldStartingAt('02-two-step')).toBeUndefined();
  });

  it('begin with the tutorial', () => {
    expect(LEVELS[0].id).toBe('00-tutorial');
  });
});
