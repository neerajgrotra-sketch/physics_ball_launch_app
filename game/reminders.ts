// Reminder notifications (local: scheduled on the phone, no server). Which ones to schedule for the next few days, worked out from the
// daily record and the player's settings. Pure: no UI imports. The phone side is components/notifications/Reminders.ts.
//
// At most one a day, and none on a day the daily is already done:
// - A player with a streak going gets the evening nudge ("your 5-day streak ends at midnight") instead of the morning teaser, so a
//   streak never brings two a day; if they play before the evening, it's rescheduled away.
// - Everyone else gets the morning teaser at their chosen time: an opening line picked by the puzzle's toughness and number, and the
//   puzzle's own one-line hint, never a spoiler.
// Only a few days are planned ahead (DAYS_AHEAD): the plan is redone every time the app opens or a daily is won, so a player who stops
// playing hears from the game a few more mornings, then not again.
import { addDays, streak, type DailyState, type DailyTier } from './daily';

export const REMINDERS_KEY = 'bank-shot/reminders';
/** Minutes after midnight of the streak nudge (7:30 pm). */
export const STREAK_TIME = 19 * 60 + 30;
/** How many days ahead are planned (today included). */
export const DAYS_AHEAD = 4;
/** The morning teaser's times on offer (minutes after midnight) and the default. */
export const REMINDER_TIMES = [8 * 60, 9 * 60, 12 * 60, 18 * 60];
export const DEFAULT_TIME = 9 * 60;

export interface ReminderPrefs {
  /** The morning teaser for the day's puzzle. */
  daily: boolean;
  /** The evening nudge when a streak would end. */
  streak: boolean;
  /** The teaser's time, minutes after midnight. */
  time: number;
  /** Whether the player has been asked (the daily card's one-time "want a nudge?"). */
  asked: boolean;
}

/** Off until the player says yes: nothing is ever scheduled before they've been asked. */
export const DEFAULT_PREFS: ReminderPrefs = { daily: false, streak: false, time: DEFAULT_TIME, asked: false };

export function parsePrefs(raw: string | null | undefined): ReminderPrefs {
  try {
    const o = raw ? JSON.parse(raw) : null;
    if (!o || typeof o !== 'object') return DEFAULT_PREFS;
    return {
      daily: o.daily === true, streak: o.streak === true, asked: o.asked === true,
      time: REMINDER_TIMES.includes(o.time) ? o.time : DEFAULT_TIME,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** What a reminder needs to know about a day's puzzle. */
export interface PuzzleInfo { number: number; name: string; hint?: string; tier: DailyTier }

export interface Reminder {
  /** The day it's for (YYYY-MM-DD, the player's own date) and when, in minutes after midnight that day. */
  day: string;
  minutes: number;
  kind: 'daily' | 'streak';
  title: string;
  body: string;
}

/** Opening lines by toughness (Monday gentle to Sunday toughest), picked by the puzzle's number so each day reads differently. */
const OPENERS: Record<DailyTier, string[]> = {
  1: ['A gentle one to start the week', 'Warm-up time', 'An easy one today'],
  2: ['Easy does it', 'A quick one today', 'Two minutes, one glass'],
  3: ['Looks hard, has a way', 'A little trickier today', 'There is a way in'],
  4: ['A proper puzzle today', 'Think before you shoot', 'Not as easy as it looks'],
  5: ["The week's toughest", 'Sunday special: the hard one', 'Bring your best trick shot'],
};
const EMOJI = ['🧩', '🎯', '🔑'];

export function teaser(p: PuzzleInfo): { title: string; body: string } {
  const lines = OPENERS[p.tier];
  const title = `${EMOJI[p.number % EMOJI.length]} ${lines[p.number % lines.length]}`;
  const body = `Daily #${p.number}, ${p.name}.${p.hint ? ` ${p.hint}` : ''}`;
  return { title, body };
}

export function streakNudge(run: number, p: PuzzleInfo): { title: string; body: string } {
  return run >= 2
    ? { title: `🔥 Your ${run}-day streak ends at midnight`, body: `Today's puzzle, #${p.number} ${p.name}, keeps it going.` }
    : { title: '🔥 Keep your streak going', body: `Yesterday's win started a streak. Today's puzzle, #${p.number} ${p.name}, keeps it alive.` };
}

/**
 * The reminders to schedule from now: one per day at most, none today if today's daily is done or its time has passed. `nowMinutes` is
 * the time now on `today`, in minutes after midnight; `puzzle` gives each day's puzzle.
 */
export function planReminders(
  state: DailyState, today: string, nowMinutes: number, prefs: ReminderPrefs, puzzle: (day: string) => PuzzleInfo,
): Reminder[] {
  const out: Reminder[] = [];
  for (let k = 0; k < DAYS_AHEAD; k++) {
    const day = addDays(today, k);
    if (k === 0 && state.days[today]) continue; // done today: nothing more today
    // A streak is alive on `day` if the day before it was kept: known for today (the record) and tomorrow (if today is already won).
    const run = k === 0 ? streak(state, today) : k === 1 && state.days[today] ? streak(state, today) : 0;
    const p = puzzle(day);
    const future = (min: number) => k > 0 || nowMinutes < min;
    if (prefs.streak && run >= 1 && future(STREAK_TIME)) {
      out.push({ day, minutes: STREAK_TIME, kind: 'streak', ...streakNudge(run, p) });
    } else if (prefs.daily && future(prefs.time) && !(prefs.streak && run >= 1)) {
      out.push({ day, minutes: prefs.time, kind: 'daily', ...teaser(p) });
    }
  }
  return out;
}

/** A time for people: "9 am", "Noon", "6 pm". */
export function timeLabel(min: number): string {
  if (min === 12 * 60) return 'Noon';
  const h = Math.floor(min / 60), m = min % 60;
  const h12 = h % 12 || 12;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
}
