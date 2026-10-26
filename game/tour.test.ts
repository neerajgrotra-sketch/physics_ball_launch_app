import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels';
import { BALL_RADIUS, WORLD, buildWorld, simulate, solutionPieces, type Level, type PlacedPiece } from '../physics';
import { TOUR, TOUR_SCENES, TOUR_VIEW_TOP, withName } from './tour';

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

describe('tour personalisation', () => {
  it('puts the name in, or leaves it out neatly', () => {
    expect(withName('Welcome to Bank Shot{, name}', 'Sam')).toBe('Welcome to Bank Shot, Sam');
    expect(withName('Welcome to Bank Shot{, name}', '  ')).toBe('Welcome to Bank Shot');
    expect(withName('Hi {name}!', '')).toBe('Hi there!');
    expect(withName('Ready{, name}?', 'Alexandria-Rose Montgomery')).toBe('Ready, Alexandria-Rose?');
  });

  it('greets the player by name at the start and at the hand-off', () => {
    expect(withName(TOUR[0].kicker, 'Sam')).toContain('Sam');
    expect(withName(TOUR[TOUR.length - 1].kicker, 'Sam')).toContain('Sam');
  });
});

describe('tour scenes', () => {
  const byId = (id: string) => LEVELS.find((l) => l.id === id)!;
  const shot = (level: Level, pieces: PlacedPiece[], power = level.solution!.power) => simulate(buildWorld(level, pieces), level.solution!.angle, power);
  const inView = (path: [number, number][]) => Math.min(...path.map((p) => p[1])) - BALL_RADIUS >= TOUR_VIEW_TOP;

  it('plays real levels whose answers land without leaving the view', () => {
    for (const { level: id } of Object.values(TOUR_SCENES)) {
      const level = byId(id);
      const res = shot(level, solutionPieces(level));
      expect(res.success, id).toBe(true);
      expect(inView(res.path), id).toBe(true);
      expect(level.glass.base ?? WORLD.ground).toBeGreaterThan(TOUR_VIEW_TOP + level.glass.h);
    }
  });

  it('shows a try that misses a bar on the goal page', () => {
    const level = byId(TOUR_SCENES.goal.level);
    const res = shot(level, solutionPieces(level), TOUR_SCENES.goal.miss.power);
    expect(res.success).toBe(false);
    expect(res.touched).toContain(false);
    expect(inView(res.path)).toBe(true);
  });

  it('turns the bars to angles that are the same line as the answer', () => {
    for (const scene of [TOUR_SCENES.bars, TOUR_SCENES.ready]) {
      const level = byId(scene.level);
      const [goal, ...rest] = solutionPieces(level);
      expect(((scene.turnTo - goal.deg) % 180 + 180) % 180).toBe(0);
      if (scene === TOUR_SCENES.bars) expect(shot(level, [{ ...goal, deg: scene.turnTo }, ...rest]).success).toBe(true);
      // where the bar is dropped, its handles and lever stay in view
      expect(scene.drop.y - 72).toBeGreaterThan(TOUR_VIEW_TOP);
    }
  });
});
