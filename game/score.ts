// Scoring, golf style: every level has a par (the fewest bounces its solver found). Pure: no UI imports.
// Bounces are counted by physics (SimResult.bounces). A win with a hint or Solve is "assisted": it
// unlocks the next level but earns no stars or score, so scores stay comparable for a future leaderboard.

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

export function bestOf(result: Result): Best {
  return { stars: starsFor(result.bounces, result.par), score: scoreFor(result), bounces: result.bounces };
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
export function goalText(pieces: number, par: number | undefined, pads = 0): string {
  const bars = pieces === 1 ? 'the bar' : pieces === 2 ? 'both bars' : `all ${pieces} bars`;
  const every = pads === 0 ? bars : `${bars} and ${pads === 1 ? 'the spring pad' : 'both spring pads'}`;
  if (par == null) return `Goal: off ${every}, then into the glass`;
  return `Goal: into the glass in ${par} bounce${par === 1 ? '' : 's'}, off ${every}`;
}
