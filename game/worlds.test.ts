import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels';
import { WORLDS, WORLD_ORDER, levelContents, worldOf, worldStartingAt } from './worlds';

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

  it('give every world its info card', () => {
    for (const w of WORLDS) {
      expect(w.tagline && w.pitch && w.tip).toBeTruthy();
      expect(w.features.length).toBeGreaterThan(0);
    }
    expect(worldOf('16-skyline')?.name).toBe('Hazards');
  });

  it('say what is on each level', () => {
    for (const l of LEVELS) expect(levelContents(l)).toMatch(/bar/);
    const portals = LEVELS.find((l) => l.portals?.length)!;
    expect(levelContents(portals)).toMatch(/portal/);
  });
});
