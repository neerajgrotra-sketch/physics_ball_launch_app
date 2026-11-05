import { describe, expect, it } from 'vitest';
import { emptyDaily, type DailyState } from './daily';
import { DAYS_AHEAD, DEFAULT_PREFS, STREAK_TIME, parsePrefs, planReminders, teaser, timeLabel, type PuzzleInfo } from './reminders';

const win = { bounces: 2, stars: 3, tries: 1, helped: false };
const puzzle = (day: string): PuzzleInfo => ({ number: Number(day.slice(8)), name: 'Two-step', hint: 'Walls in the way.', tier: 3 });
const on = { ...DEFAULT_PREFS, daily: true, streak: true, asked: true };
const withDays = (...days: string[]): DailyState => ({ ...emptyDaily(), days: Object.fromEntries(days.map((d) => [d, win])) });

describe('reminders', () => {
  it('schedules nothing until the player has said yes', () => {
    expect(planReminders(emptyDaily(), '2026-11-05', 6 * 60, DEFAULT_PREFS, puzzle)).toEqual([]);
  });

  it('sends a morning teaser a day, from today if the time is still ahead', () => {
    const plan = planReminders(emptyDaily(), '2026-11-05', 7 * 60, on, puzzle);
    expect(plan.map((r) => r.day)).toEqual(['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'].slice(0, DAYS_AHEAD));
    expect(plan.every((r) => r.kind === 'daily' && r.minutes === on.time)).toBe(true);
    // Past the time today: from tomorrow.
    expect(planReminders(emptyDaily(), '2026-11-05', 10 * 60, on, puzzle)[0].day).toBe('2026-11-06');
  });

  it('sends nothing more today once the daily is done', () => {
    const plan = planReminders(withDays('2026-11-05'), '2026-11-05', 7 * 60, on, puzzle);
    expect(plan.some((r) => r.day === '2026-11-05')).toBe(false);
  });

  it('swaps the morning teaser for one evening nudge while a streak is at stake, never both', () => {
    const state = withDays('2026-11-03', '2026-11-04');
    const plan = planReminders(state, '2026-11-05', 7 * 60, on, puzzle);
    const today = plan.filter((r) => r.day === '2026-11-05');
    expect(today).toHaveLength(1);
    expect(today[0]).toMatchObject({ kind: 'streak', minutes: STREAK_TIME });
    expect(today[0].title).toContain('2-day streak');
    // Later days: the streak's fate is unknown, so the morning teaser.
    expect(plan.find((r) => r.day === '2026-11-06')?.kind).toBe('daily');
  });

  it('after today is won, tomorrow gets the streak nudge with the longer run', () => {
    const plan = planReminders(withDays('2026-11-04', '2026-11-05'), '2026-11-05', 20 * 60, on, puzzle);
    const tomorrow = plan.find((r) => r.day === '2026-11-06');
    expect(tomorrow?.kind).toBe('streak');
    expect(tomorrow?.title).toContain('2-day');
  });

  it('respects each switch on its own', () => {
    const state = withDays('2026-11-04');
    expect(planReminders(state, '2026-11-05', 7 * 60, { ...on, streak: false }, puzzle)[0].kind).toBe('daily');
    expect(planReminders(state, '2026-11-05', 7 * 60, { ...on, daily: false }, puzzle).map((r) => r.kind)).toEqual(['streak']);
  });

  it('writes a teaser from the puzzle without giving it away', () => {
    const t = teaser({ number: 11, name: 'Two-step', hint: 'Walls in the way.', tier: 3 });
    expect(t.body).toBe('Daily #11, Two-step. Walls in the way.');
    expect(t.title.length).toBeGreaterThan(5);
  });

  it('reads saved settings safely and labels times', () => {
    expect(parsePrefs('nonsense')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs(JSON.stringify({ daily: true, time: 12 * 60 })).time).toBe(720);
    expect(parsePrefs(JSON.stringify({ time: 5 })).time).toBe(DEFAULT_PREFS.time);
    expect([8 * 60, 12 * 60, 18 * 60].map(timeLabel)).toEqual(['8 am', 'Noon', '6 pm']);
  });
});
