// The hint wallet (💡): Solve's hints and full solution are paid from a balance instead of an ad each time. A new player starts with
// enough to be helped through the first few levels without an ad; after that they earn more (a daily gift, three-star wins, finishing
// a world), watch an ad for a few, or buy a pack in the shop. Saved on the device. Pure: no UI imports, so Vitest covers it.

export const WALLET_KEY = 'bank-shot/hints';

/** What a new player starts with: enough to fully solve each of the first four levels (3 + 4 + 5 + 5 steps would be 17). */
export const STARTER_HINTS = 15;
/** One rewarded ad buys this many, so a stuck player watches one ad, not one per step. */
export const AD_REWARD = 3;
/** Given once a day when the game is opened. */
export const DAILY_GIFT = 2;
/** For a level's first unassisted three-star win. */
export const STAR_REWARD = 1;
/** For winning the last level of a world, once per world. */
export const WORLD_REWARD = 5;

export interface Wallet {
  hints: number;
  /** The day (YYYY-MM-DD, the player's own calendar) the daily gift was last given. */
  lastGift: string | null;
  /** Levels whose three-star reward has been given, so replays can't farm it. */
  starLevels: string[];
  /** Worlds whose completion reward has been given. */
  worlds: string[];
}

export function newWallet(): Wallet {
  return { hints: STARTER_HINTS, lastGift: null, starLevels: [], worlds: [] };
}

/** The saved wallet, or a new one (with the starter hints) when nothing valid is saved. */
export function parseWallet(raw: string | null | undefined): Wallet {
  if (!raw) return newWallet();
  try {
    const o = JSON.parse(raw);
    const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
    return {
      hints: Number.isFinite(o?.hints) ? Math.max(0, Math.floor(o.hints)) : STARTER_HINTS,
      lastGift: typeof o?.lastGift === 'string' ? o.lastGift : null,
      starLevels: strings(o?.starLevels),
      worlds: strings(o?.worlds),
    };
  } catch {
    return newWallet();
  }
}

export function grant(w: Wallet, n: number): Wallet {
  return { ...w, hints: w.hints + Math.max(0, Math.floor(n)) };
}

/** The wallet after spending n, or null when there aren't enough. */
export function spend(w: Wallet, n: number): Wallet | null {
  return w.hints >= n ? { ...w, hints: w.hints - n } : null;
}

/** The local calendar day of a date, as YYYY-MM-DD. */
export function dayOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Today's gift, if it hasn't been given yet today. A brand-new player gets the starter hints instead, so the first day is skipped. */
export function claimDaily(w: Wallet, today: string): { wallet: Wallet; given: number } {
  if (w.lastGift === today) return { wallet: w, given: 0 };
  if (w.lastGift === null) return { wallet: { ...w, lastGift: today }, given: 0 };
  return { wallet: { ...grant(w, DAILY_GIFT), lastGift: today }, given: DAILY_GIFT };
}

/** A level's three-star reward, once per level. */
export function claimStars(w: Wallet, levelId: string): { wallet: Wallet; given: number } {
  if (w.starLevels.includes(levelId)) return { wallet: w, given: 0 };
  return { wallet: { ...grant(w, STAR_REWARD), starLevels: [...w.starLevels, levelId] }, given: STAR_REWARD };
}

/** A world's completion reward, once per world. */
export function claimWorld(w: Wallet, world: string): { wallet: Wallet; given: number } {
  if (w.worlds.includes(world)) return { wallet: w, given: 0 };
  return { wallet: { ...grant(w, WORLD_REWARD), worlds: [...w.worlds, world] }, given: WORLD_REWARD };
}

/** What the full solution costs with `stepsLeft` steps of the answer still missing: one less than hinting them all, at least 1. */
export function solutionCost(stepsLeft: number): number {
  return Math.max(1, stepsLeft - 1);
}

/** The shop's packs. `tag` is a small label on the card. Prices are in CAD; the store builds will show the store's own prices. */
export interface Pack { id: string; hints: number; price: string; tag?: string }
export const PACKS: Pack[] = [
  { id: 'hints_30', hints: 30, price: 'CA$1.99' },
  { id: 'hints_80', hints: 80, price: 'CA$3.99', tag: 'Most popular' },
  { id: 'hints_200', hints: 200, price: 'CA$7.99', tag: 'Best value' },
];
