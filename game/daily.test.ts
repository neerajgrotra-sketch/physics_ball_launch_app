import { describe, expect, it } from 'vitest';
import {
  MAX_FREEZES, WEEK_BONUS, addDays, applyFreezes, fullWeek, weekOf, weekSlots,
  DAILY_EPOCH, DAILY_HELPED_WIN, DAILY_THREE_STARS, DAILY_TIERS, DAILY_WIN, dailyFor, dayBefore, daysBetween, emptyDaily, parseDaily,
  streak, untilTomorrow, winDaily, type DailyState,
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
    const s: DailyState = { ...emptyDaily(), days: { '2026-10-25': win, '2026-10-26': win }, best: 2 };
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

});

describe('winDaily, a second win the same day', () => {
  it('keeps the better result and gives no more hints', () => {
    const first = winDaily(emptyDaily(), '2026-11-02', { bounces: 6, stars: 1, tries: 11, helped: false });
    const again = winDaily(first.state, '2026-11-02', { bounces: 3, stars: 3, tries: 22, helped: false });
    expect(again.hints).toBe(0);
    expect(again.state.days['2026-11-02']).toMatchObject({ bounces: 3, stars: 3 });
    const worse = winDaily(again.state, '2026-11-02', { bounces: 8, stars: 1, tries: 30, helped: false });
    expect(worse.state).toBe(again.state);
  });
});

describe('daily puzzle: the week stamp card', () => {
  // DAILY_EPOCH (2026-10-26) is a Monday.
  const mon = '2026-11-02', week = (k: number) => addDays(mon, k);

  it('finds the Monday of any day', () => {
    expect(weekOf(mon)).toBe(mon);
    expect(weekOf(week(6))).toBe(mon);
    expect(weekOf(week(7))).toBe(week(7));
    expect(weekOf('2026-10-25')).toBe('2026-10-19'); // a Sunday before puzzle #1
  });

  it('shows won, helped, missed, today and the days to come, and nothing owed before the first daily', () => {
    let s = emptyDaily();
    s = winDaily(s, week(1), win).state;                       // Tue, first ever
    s = winDaily(s, week(2), { ...win, helped: true }).state;  // Wed with help
    const slots = weekSlots(s, week(4));                       // Fri, Thu missed
    expect(slots.map((x) => x.state)).toEqual(['blank', 'won', 'helped', 'missed', 'today', 'future', 'future']);
    expect(slots[1].stars).toBe(3);
    expect(slots.map((x) => x.tier)).toEqual([1, 2, 2, 3, 3, 4, 5]);
  });

  it('rewards a full week once, with hints and a freeze', () => {
    let s = emptyDaily(), hints = 0;
    for (let k = 0; k < 7; k++) { const r = winDaily(s, week(k), { ...win, helped: k === 3 }); s = r.state; hints = r.hints; }
    expect(fullWeek(s, mon)).toBe(true);
    expect(s.freezes).toBe(1);
    expect(s.weeks).toEqual([mon]);
    expect(hints).toBeGreaterThanOrEqual(WEEK_BONUS);
    expect(winDaily(s, week(6), win).state.freezes).toBe(1); // the same day again: no second reward
  });

  it('spends a freeze on a missed day so the streak lives on', () => {
    let s = { ...emptyDaily(), freezes: 1 };
    s = winDaily(s, week(0), win).state;
    s = winDaily(s, week(1), win).state;
    // Wednesday missed; on Thursday the freeze covers it.
    const thu = applyFreezes(s, week(3));
    expect(thu.frozen).toEqual([week(2)]);
    expect(thu.freezes).toBe(0);
    expect(streak(thu, week(3))).toBe(2);
    expect(weekSlots(thu, week(3))[2].state).toBe('frozen');
    const after = winDaily(thu, week(3), win).state;
    expect(streak(after, week(3))).toBe(3);
    expect(fullWeek(after, mon)).toBe(false); // a frozen day doesn't make a full week
  });

  it('keeps the freezes when the gap is longer than they can cover, or there was no streak', () => {
    let s = { ...emptyDaily(), freezes: 1 };
    s = winDaily(s, week(0), win).state;
    const late = applyFreezes(s, week(3)); // Tue and Wed missed, one freeze
    expect(late.freezes).toBe(1);
    expect(streak(late, week(3))).toBe(0);
    expect(applyFreezes({ ...emptyDaily(), freezes: 2 }, week(3)).freezes).toBe(2);
    expect(applyFreezes(s, week(1))).toBe(s); // nothing missed yet
  });

  it('holds at most MAX_FREEZES', () => {
    let s = { ...emptyDaily(), freezes: MAX_FREEZES };
    for (let k = 0; k < 7; k++) s = winDaily(s, week(k), win).state;
    expect(s.freezes).toBe(MAX_FREEZES);
  });
});
