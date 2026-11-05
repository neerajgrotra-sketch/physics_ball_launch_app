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
/** A full week (all seven days, Monday to Sunday, won on the day) gives this many hints and a streak freeze. */
export const WEEK_BONUS = 5;
/** Streak freezes held at most. One covers one missed day, spent by itself; they're earned (full weeks), never bought. */
export const MAX_FREEZES = 2;
/** The weekday initials of the stamp card, Monday first. */
export const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

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
  /** Streak freezes held (0 to MAX_FREEZES). */
  freezes: number;
  /** Missed days a freeze covered: they keep the streak going but aren't wins. */
  frozen: string[];
  /** Mondays of the weeks already rewarded as full, so a week pays once. */
  weeks: string[];
  /** The last day whose stamp was thumped onto the card, so the stamp-in plays once. */
  stamped: string;
}

export function emptyDaily(): DailyState {
  return { days: {}, best: 0, freezes: 0, frozen: [], weeks: [], stamped: '' };
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
    const dates = (v: unknown) => (Array.isArray(v) ? v.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) : []);
    return {
      days, best: Number.isFinite(o?.best) ? o.best : 0,
      freezes: Number.isFinite(o?.freezes) ? Math.max(0, Math.min(MAX_FREEZES, o.freezes)) : 0,
      frozen: dates(o?.frozen), weeks: dates(o?.weeks), stamped: typeof o?.stamped === 'string' ? o.stamped : '',
    };
  } catch {
    return emptyDaily();
  }
}

/**
 * The saved record and a newer one combined, so a save can never lose a day: every day won in either is kept (the better result where
 * both have it: more stars, then fewer bounces), and so are frozen days and full weeks; the best streak is the higher. Freezes left and
 * the last stamped day are the newer record's (spending a freeze is a real change). 0.54.0 to 0.66.4 could overwrite the saved
 * record with an empty one if something saved before it had loaded, wiping earlier days.
 */
export function mergeDaily(saved: DailyState, next: DailyState): DailyState {
  const days: Record<string, DailyResult> = { ...saved.days };
  for (const [day, r] of Object.entries(next.days)) {
    const had = days[day];
    days[day] = !had || r.stars > had.stars || (r.stars === had.stars && r.bounces <= had.bounces) ? r : had;
  }
  const union = (a: string[], b: string[]) => [...new Set([...a, ...b])].sort();
  return {
    days, best: Math.max(saved.best, next.best), freezes: next.freezes,
    frozen: union(saved.frozen, next.frozen).filter((d) => !days[d]), weeks: union(saved.weeks, next.weeks),
    stamped: next.stamped || saved.stamped,
  };
}

/** The day before a YYYY-MM-DD. */
export function dayBefore(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** A YYYY-MM-DD `n` days after (or before, if negative) another. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** The Monday of a day's week (DAILY_EPOCH is a Monday). */
export function weekOf(day: string): string {
  return addDays(day, -(((daysBetween(DAILY_EPOCH, day) % 7) + 7) % 7));
}

/** Whether a day keeps the streak going: won, or covered by a freeze. */
const kept = (state: DailyState, day: string) => !!state.days[day] || state.frozen.includes(day);

/**
 * The current streak: days in a row won (or covered by a freeze), counting back from today, or from yesterday if today isn't won yet
 * (a streak isn't lost until a whole day is missed). Frozen days hold it together but don't add to it.
 */
export function streak(state: DailyState, today: string): number {
  let day = kept(state, today) ? today : dayBefore(today);
  let n = 0;
  while (kept(state, day)) { if (state.days[day]) n++; day = dayBefore(day); }
  return n;
}

/**
 * Spends streak freezes on days missed since the last played day, once those days are over: a gap of missed days just before today is
 * covered if there are enough freezes for all of it and there was a streak to save. A longer gap breaks the streak and the freezes
 * are kept for next time. Run it whenever the day may have moved on (the provider does on load and as the clock ticks).
 */
export function applyFreezes(state: DailyState, today: string): DailyState {
  if (!state.freezes) return state;
  const gap: string[] = [];
  let day = dayBefore(today);
  while (!kept(state, day) && gap.length <= state.freezes) { gap.push(day); day = dayBefore(day); }
  if (!gap.length || gap.length > state.freezes || !state.days[day]) return state;
  return { ...state, freezes: state.freezes - gap.length, frozen: [...state.frozen, ...gap].sort() };
}

/** One slot of the week's stamp card. */
export interface StampSlot {
  day: string;
  /** Monday is 0. */
  weekday: number;
  tier: DailyTier;
  state: 'won' | 'helped' | 'frozen' | 'missed' | 'today' | 'future' | 'blank';
  stars: number;
}

/**
 * Today's week as seven stamp slots, Monday to Sunday: won (with its stars), won with help, frozen, missed, today (not yet played),
 * or still to come. Days before the player's first daily (and before puzzle #1) are blank, not missed: nobody owes a puzzle they
 * never had.
 */
export function weekSlots(state: DailyState, today: string): StampSlot[] {
  const monday = weekOf(today);
  const first = [...Object.keys(state.days), ...state.frozen].sort()[0] ?? today;
  return WEEKDAYS.map((_, k) => {
    const day = addDays(monday, k);
    const won = state.days[day];
    const base = { day, weekday: k, tier: DAILY_TIERS[k], stars: won?.stars ?? 0 };
    if (won) return { ...base, state: won.helped ? 'helped' : 'won' };
    if (state.frozen.includes(day)) return { ...base, state: 'frozen' };
    if (day === today) return { ...base, state: 'today' };
    if (day > today) return { ...base, state: 'future' };
    return { ...base, state: day < first || day < DAILY_EPOCH ? 'blank' : 'missed' };
  });
}

/** Whether every day of a week (its Monday given) was won, help or not; frozen days don't count. */
export function fullWeek(state: DailyState, monday: string): boolean {
  return WEEKDAYS.every((_, k) => !!state.days[addDays(monday, k)]);
}

/**
 * Records today's win (only the first counts; a replay can't earn twice) and works out the hints it earns: the win itself (less with
 * help), three stars, and a streak milestone if this win reaches one. Returns the new state, the hints, and the reasons, for the message.
 */
export function winDaily(prev: DailyState, today: string, result: DailyResult): { state: DailyState; hints: number; reasons: string[] } {
  const state = applyFreezes(prev, today);
  const had = state.days[today];
  // A later win the same day earns nothing more, but the day keeps its best result (more stars, then fewer bounces).
  if (had) {
    const better = result.stars > had.stars || (result.stars === had.stars && result.bounces < had.bounces);
    return { state: better ? { ...state, days: { ...state.days, [today]: result } } : state, hints: 0, reasons: [] };
  }
  const next: DailyState = { ...state, days: { ...state.days, [today]: result } };
  const monday = weekOf(today);
  const week = fullWeek(next, monday) && !next.weeks.includes(monday);
  if (week) { next.weeks = [...next.weeks, monday]; next.freezes = Math.min(MAX_FREEZES, next.freezes + 1); }
  const run = streak(next, today);
  next.best = Math.max(state.best, run);
  const reasons: string[] = [];
  let hints = result.helped ? DAILY_HELPED_WIN : DAILY_WIN;
  reasons.push(`+${hints} 💡 daily puzzle`);
  if (!result.helped && result.stars === 3) { hints += DAILY_THREE_STARS; reasons.push(`+${DAILY_THREE_STARS} 💡 three stars`); }
  if (STREAK_BONUS[run]) { hints += STREAK_BONUS[run]; reasons.push(`+${STREAK_BONUS[run]} 💡 ${run}-day streak!`); }
  if (week) { hints += WEEK_BONUS; reasons.push(`+${WEEK_BONUS} 💡 full week! +1 ❄️ streak freeze`); }
  return { state: next, hints, reasons };
}

/** Time left until the next puzzle (the player's midnight), as "5h 12m" or "12m". */
export function untilTomorrow(now: Date): string {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const mins = Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 60_000));
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}
