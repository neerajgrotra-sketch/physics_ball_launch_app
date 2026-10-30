// Scoring, golf style: every level has a par (the fewest bounces its solver found). Pure: no UI imports.
// Bounces are counted by physics (SimResult.bounces). A win with help (a hint, or the full solution) still counts and scores, but
// capped by the help used on that level (starCap): the cap is saved per level and survives Start over, so taking the answer and
// rebuilding it can't earn three stars.

/** Storage key for each level's best result. */
export const BEST_KEY = 'bank-shot/best';

export interface Result { bounces: number; par: number; tries: number }
export interface Best { stars: number; score: number; bounces: number }
export type BestByLevel = Record<string, Best>;

/** Golf name for a shot: Eagle, Birdie, Par, Bogey, Double bogey, or "+n" beyond that. */
export function golfName(bounces: number, par: number): string {
  const d = bounces - par;
  if (d <= -2) return d === -2 ? 'Eagle' : 'Albatross';
  if (d === -1) return 'Birdie';
  if (d === 0) return 'Par';
  if (d === 1) return 'Bogey';
  if (d === 2) return 'Double bogey';
  return `+${d}`;
}

/** 3 stars at par or better, 2 within two of par, 1 for any other landing. */
export function starsFor(bounces: number, par: number): number {
  return bounces <= par ? 3 : bounces <= par + 2 ? 2 : 1;
}

/**
 * What it takes to earn more stars, for the win card; null at three stars.
 * e.g. "Get it in with 5 bounces or fewer for ★★, or 3 for ★★★".
 */
export function nextStarsText(bounces: number, par: number): string | null {
  const stars = starsFor(bounces, par);
  if (stars === 3) return null;
  if (stars === 2) return `Get it in with ${par} bounce${par === 1 ? '' : 's'} or fewer for ★★★`;
  return `Get it in with ${par + 2} bounces or fewer for ★★, or ${par} for ★★★`;
}

/**
 * Points for a win: 500 for landing; 300 at par, plus 200 for each bounce under it or minus 100 for each
 * over (never below 0); and a bonus for few tries: 200 on the first, 100 on the second, 50 on the third.
 */
export function scoreFor({ bounces, par, tries }: Result): number {
  const d = bounces - par;
  const bounceBonus = d <= 0 ? 300 + 200 * -d : Math.max(0, 300 - 100 * d);
  const triesBonus = tries === 1 ? 200 : tries === 2 ? 100 : tries === 3 ? 50 : 0;
  return 500 + bounceBonus + triesBonus;
}

/** Storage key for the help used on each level (hintsUsed below), kept for good: Start over doesn't clear it. */
export const HELP_KEY = 'bank-shot/help';
/** Help used on each level: 1 = one hint, 2 = two or more hints, or the full solution. Absent = none. */
export type HelpByLevel = Record<string, number>;
/** The help a level has after one more hint, or after the full solution. */
export const afterHint = (help: number) => Math.min(2, help + 1);
export const AFTER_SOLUTION = 2;

/** Most stars a level can still earn: ★★★ with no help, ★★ after one hint, ★ after more hints or the full solution. */
export function starCap(help: number): number {
  return help <= 0 ? 3 : help === 1 ? 2 : 1;
}

/**
 * A helped shot is scored as if it took at least as many bounces as its cap allows (par + 1 for ★★, par + 3 for ★), so its stars
 * and points both follow the cap and are never above what the shot itself earned.
 */
export function cappedBounces(bounces: number, par: number, help: number): number {
  const cap = starCap(help);
  return cap === 3 ? bounces : Math.max(bounces, par + (cap === 2 ? 1 : 3));
}

export function bestOf(result: Result, help = 0): Best {
  const b = cappedBounces(result.bounces, result.par, help);
  return { stars: starsFor(b, result.par), score: scoreFor({ ...result, bounces: b }), bounces: result.bounces };
}

/** The help card's line on what help costs in stars on a level, given the help already used there. */
export function helpNote(help: number): string {
  if (help <= 0) return 'A hint caps this level at ★★, more help or the full solution at ★. It still opens the next level.';
  if (help === 1) return 'This level is capped at ★★ (you used a hint). Another hint or the full solution caps it at ★.';
  return 'This level is capped at ★ (you used help). Hints from here cost no more stars.';
}

/** Read the stored help record, dropping anything malformed. */
export function parseHelp(raw: string | null): HelpByLevel {
  try {
    const o = JSON.parse(raw ?? '{}');
    const out: HelpByLevel = {};
    if (o && typeof o === 'object') for (const [id, n] of Object.entries(o as Record<string, unknown>)) {
      if (typeof n === 'number' && n > 0) out[id] = Math.min(2, Math.round(n));
    }
    return out;
  } catch {
    return {};
  }
}

/** Keeps the higher score (ties: the fewer bounces). */
export function better(a: Best | undefined, b: Best): Best {
  if (!a) return b;
  if (b.score !== a.score) return b.score > a.score ? b : a;
  return b.bounces < a.bounces ? b : a;
}

/** Read stored bests, dropping anything malformed. */
export function parseBest(raw: string | null): BestByLevel {
  try {
    const o = JSON.parse(raw ?? '{}');
    const out: BestByLevel = {};
    if (o && typeof o === 'object') for (const [id, b] of Object.entries(o as Record<string, Partial<Best>>)) {
      if (b && typeof b.stars === 'number' && typeof b.score === 'number' && typeof b.bounces === 'number')
        out[id] = { stars: b.stars, score: b.score, bounces: b.bounces };
    }
    return out;
  } catch {
    return {};
  }
}

/** Sum of best scores across levels, for the level list (and later a leaderboard). */
export function totalScore(best: BestByLevel): number {
  return Object.values(best).reduce((n, b) => n + b.score, 0);
}

/**
 * The goal line under the board, with the bounce target, e.g. "Goal: into the glass in 3 bounces,
 * off all 3 bars" (par is the target: that many bounces or fewer earns ★★★).
 */
export function goalText(pieces: number, par: number | undefined, pads = 0, portals = 0): string {
  const bars = pieces === 1 ? 'the bar' : pieces === 2 ? 'both bars' : `all ${pieces} bars`;
  const extras = [
    pads === 0 ? '' : pads === 1 ? 'the spring pad' : 'both spring pads',
    portals === 0 ? '' : portals === 1 ? 'through the portal' : 'through both portals',
  ].filter(Boolean);
  const every = [bars, ...extras].join(' and ');
  if (par == null) return `Goal: off ${every}, then into the glass`;
  return `Goal: into the glass in ${par} bounce${par === 1 ? '' : 's'}, off ${every}`;
}
