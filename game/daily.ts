// The daily puzzle: one puzzle a day, the same for everyone, picked from the generated pool (levels/daily, tools/make-dailies.ts) by
// the date, with a streak and hint rewards. Days roll over at the player's own midnight. Pure: no UI imports, so Vitest covers it.

export type DailyTier = 1 | 2 | 3 | 4 | 5;

/** How tough each weekday's puzzle is, Monday first: gentle at the start of the week, hardest on Sunday. */
export const DAILY_TIERS: DailyTier[] = [1, 2, 2, 3, 3, 4, 5];

/** How the card and header name each tier. */
export const TIER_NAMES: Record<DailyTier, string> = { 1: 'Easy', 2: 'Easy', 3: 'Medium', 4: 'Hard', 5: 'Toughest' };

/** Puzzle #1 is this Monday's (local date). The pool repeats after its last puzzle; its size is a multiple of 7 so weekdays line up. */
export const DAILY_EPOCH = '2026-10-26';

export const DAILY_KEY = 'bank-shot/daily';

/** Hint rewards (game/wallet.ts): for winning today's puzzle, extra for three stars, and for streak milestones. */
export const DAILY_WIN = 2;
export const DAILY_THREE_STARS = 1;
/** A win that used a hint or Solve still keeps the streak, but earns only this. */
export const DAILY_HELPED_WIN = 1;
export const STREAK_BONUS: Record<number, number> = { 7: 5, 30: 15, 100: 50 };

/** Days from one YYYY-MM-DD to another (calendar days; daylight saving can't shift it). */
export function daysBetween(from: string, to: string): number {
  const ms = (d: string) => { const [y, m, day] = d.split('-').map(Number); return Date.UTC(y, m - 1, day); };
  return Math.round((ms(to) - ms(from)) / 86_400_000);
}

/** Today's puzzle number (1, 2, 3…) and its index in a pool of `size`. Before the first day it's puzzle #1. */
export function dailyFor(today: string, size: number): { number: number; index: number } {
  const n = Math.max(0, daysBetween(DAILY_EPOCH, today));
  return { number: n + 1, index: size ? n % size : 0 };
}

/** One day's result, kept so the card can show "done" and the streak can be counted. */
export interface DailyResult { bounces: number; stars: number; tries: number; helped: boolean }

export interface DailyState {
  /** Results by day (YYYY-MM-DD). Only days that were won are here. */
  days: Record<string, DailyResult>;
  /** The longest streak ever, for the card. */
  best: number;
}

export function emptyDaily(): DailyState {
  return { days: {}, best: 0 };
}

export function parseDaily(raw: string | null | undefined): DailyState {
  if (!raw) return emptyDaily();
  try {
    const o = JSON.parse(raw);
    const days: Record<string, DailyResult> = {};
    for (const [k, v] of Object.entries(o?.days ?? {})) {
      const r = v as Partial<DailyResult>;
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof r?.bounces === 'number') {
        days[k] = { bounces: r.bounces, stars: r.stars ?? 0, tries: r.tries ?? 1, helped: !!r.helped };
      }
    }
    return { days, best: Number.isFinite(o?.best) ? o.best : 0 };
  } catch {
    return emptyDaily();
  }
}

/** The day before a YYYY-MM-DD. */
export function dayBefore(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/**
 * The current streak: days in a row won, counting back from today, or from yesterday if today isn't won yet (a streak isn't lost
 * until a whole day is missed).
 */
export function streak(state: DailyState, today: string): number {
  let day = state.days[today] ? today : dayBefore(today);
  let n = 0;
  while (state.days[day]) { n++; day = dayBefore(day); }
  return n;
}

/**
 * Records today's win (only the first counts; a replay can't earn twice) and works out the hints it earns: the win itself (less with
 * help), three stars, and a streak milestone if this win reaches one. Returns the new state, the hints, and the reasons, for the message.
 */
export function winDaily(state: DailyState, today: string, result: DailyResult): { state: DailyState; hints: number; reasons: string[] } {
  const had = state.days[today];
  // A later win the same day earns nothing more, but the day keeps its best result (more stars, then fewer bounces).
  if (had) {
    const better = result.stars > had.stars || (result.stars === had.stars && result.bounces < had.bounces);
    return { state: better ? { ...state, days: { ...state.days, [today]: result } } : state, hints: 0, reasons: [] };
  }
  const next: DailyState = { ...state, days: { ...state.days, [today]: result } };
  const run = streak(next, today);
  next.best = Math.max(state.best, run);
  const reasons: string[] = [];
  let hints = result.helped ? DAILY_HELPED_WIN : DAILY_WIN;
  reasons.push(`+${hints} 💡 daily puzzle`);
  if (!result.helped && result.stars === 3) { hints += DAILY_THREE_STARS; reasons.push(`+${DAILY_THREE_STARS} 💡 three stars`); }
  if (STREAK_BONUS[run]) { hints += STREAK_BONUS[run]; reasons.push(`+${STREAK_BONUS[run]} 💡 ${run}-day streak!`); }
  return { state: next, hints, reasons };
}

/** Time left until the next puzzle (the player's midnight), as "5h 12m" or "12m". */
export function untilTomorrow(now: Date): string {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const mins = Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 60_000));
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}
