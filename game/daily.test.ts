import { describe, expect, it } from 'vitest';
import {
  DAILY_EPOCH, DAILY_HELPED_WIN, DAILY_THREE_STARS, DAILY_TIERS, DAILY_WIN, dailyFor, dayBefore, daysBetween, emptyDaily, parseDaily,
  shareText, streak, untilTomorrow, winDaily, type DailyState,
} from './daily';

const win = { bounces: 3, stars: 3, tries: 2, helped: false };

describe('daily puzzle: which one today', () => {
  it('numbers the days from the first Monday, and repeats the pool', () => {
    expect(new Date(`${DAILY_EPOCH}T12:00:00Z`).getUTCDay()).toBe(1); // a Monday, so DAILY_TIERS lines up with weekdays
    expect(dailyFor(DAILY_EPOCH, 28)).toEqual({ number: 1, index: 0 });
    expect(dailyFor('2026-10-27', 28)).toEqual({ number: 2, index: 1 });
    expect(dailyFor('2026-11-23', 28)).toEqual({ number: 29, index: 0 });
    expect(dailyFor('2026-01-01', 28)).toEqual({ number: 1, index: 0 });
    expect(DAILY_TIERS).toHaveLength(7);
  });

  it('counts calendar days across month and year ends', () => {
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(dayBefore('2027-03-01')).toBe('2027-02-28');
    expect(dayBefore('2026-11-01')).toBe('2026-10-31');
  });
});

describe('daily puzzle: streak and rewards', () => {
  it('counts days in a row, and keeps the streak until a whole day is missed', () => {
    const s: DailyState = { days: { '2026-10-25': win, '2026-10-26': win }, best: 2 };
    expect(streak(s, '2026-10-26')).toBe(2);
    expect(streak(s, '2026-10-27')).toBe(2); // today not played yet
    expect(streak(s, '2026-10-28')).toBe(0); // yesterday missed
    expect(streak(emptyDaily(), '2026-10-27')).toBe(0);
  });

  it('rewards a win once a day, less with help, extra for three stars', () => {
    const a = winDaily(emptyDaily(), '2026-10-27', win);
    expect(a.hints).toBe(DAILY_WIN + DAILY_THREE_STARS);
    expect(winDaily(a.state, '2026-10-27', win).hints).toBe(0);
    expect(winDaily(emptyDaily(), '2026-10-27', { ...win, helped: true }).hints).toBe(DAILY_HELPED_WIN);
    expect(winDaily(emptyDaily(), '2026-10-27', { ...win, stars: 2 }).hints).toBe(DAILY_WIN);
  });

  it('adds a streak bonus on the seventh day in a row', () => {
    let s = emptyDaily();
    const days = ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];
    for (const d of days) s = winDaily(s, d, { ...win, stars: 2 }).state;
    const seventh = winDaily(s, '2026-10-26', { ...win, stars: 2 });
    expect(seventh.hints).toBe(DAILY_WIN + 5);
    expect(seventh.reasons.join(' ')).toMatch(/7-day streak/);
    expect(seventh.state.best).toBe(7);
  });

  it('reads back what was saved, and survives junk', () => {
    const s = winDaily(emptyDaily(), '2026-10-27', win).state;
    expect(parseDaily(JSON.stringify(s))).toEqual(s);
    expect(parseDaily('nope')).toEqual(emptyDaily());
    expect(parseDaily(JSON.stringify({ days: { bad: win } }))).toEqual(emptyDaily());
  });
});

describe('daily puzzle: words', () => {
  it('counts down to midnight', () => {
    expect(untilTomorrow(new Date(2026, 9, 27, 21, 30))).toBe('2h 30m');
    expect(untilTomorrow(new Date(2026, 9, 27, 23, 50))).toBe('10m');
  });

  it('shares the result without spoilers', () => {
    expect(shareText(2, win, 3, 5)).toBe('Bank Shot Daily #2\n★★★ · 3 bounces (par 3) · 2 tries\n🔥 5-day streak');
    expect(shareText(2, { ...win, tries: 1, helped: true }, 3, 1)).toBe('Bank Shot Daily #2\nsolved with help · 3 bounces (par 3) · 1 try');
  });
});
