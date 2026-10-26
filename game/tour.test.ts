import { describe, expect, it } from 'vitest';
import { TOUR } from './tour';

describe('guided tour', () => {
  it('starts with what the game is and ends by handing over to the tutorial', () => {
    expect(TOUR[0].picture).toBe('welcome');
    expect(TOUR[TOUR.length - 1].picture).toBe('ready');
    expect(TOUR[TOUR.length - 1].body).toMatch(/step by step/);
  });

  it('covers the controls, the pieces and where to get help', () => {
    const all = TOUR.map((p) => [p.title, p.body, ...(p.points ?? [])].join(' ')).join(' ');
    for (const word of ['Angle', 'power', 'bar', 'Spikes', 'Portals', 'springs', 'Solve', 'hint', 'par']) {
      expect(all.toLowerCase()).toContain(word.toLowerCase());
    }
  });

  it('keeps every screen short enough to read on a phone', () => {
    for (const p of TOUR) {
      expect(p.title.length).toBeLessThanOrEqual(30);
      expect(p.body.length).toBeLessThanOrEqual(200);
      expect((p.points ?? []).length).toBeLessThanOrEqual(4);
    }
  });
});
