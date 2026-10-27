import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels';
import {
  AD_REWARD, DAILY_GIFT, PACKS, STARTER_HINTS, claimDaily, claimStars, claimWorld, dayOf, grant, newWallet, parseWallet, solutionCost, spend,
} from './wallet';

describe('hint wallet', () => {
  it('starts a new player with enough hints to fully solve the first four levels but one', () => {
    expect(parseWallet(null).hints).toBe(STARTER_HINTS);
    expect(parseWallet('not json').hints).toBe(STARTER_HINTS);
    // Fully hinting a level is one step per bar plus the angle and the power.
    const steps = LEVELS.slice(1, 5).map((l) => l.pieces.length + 2);
    expect(steps.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(STARTER_HINTS);
    expect(steps.slice(0, 3).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(STARTER_HINTS);
  });

  it('keeps what was saved, and never goes negative', () => {
    const w = parseWallet(JSON.stringify({ hints: 4, lastGift: '2026-10-27', starLevels: ['01-first-bounce'], worlds: [] }));
    expect(w).toEqual({ hints: 4, lastGift: '2026-10-27', starLevels: ['01-first-bounce'], worlds: [] });
    expect(parseWallet(JSON.stringify({ hints: -3 })).hints).toBe(0);
  });

  it('spends only what it has', () => {
    const w = { ...newWallet(), hints: 2 };
    expect(spend(w, 2)?.hints).toBe(0);
    expect(spend(w, 3)).toBeNull();
    expect(grant(w, AD_REWARD).hints).toBe(2 + AD_REWARD);
  });

  it('gives the daily gift once a day, from the second day', () => {
    const first = claimDaily(newWallet(), '2026-10-27');
    expect(first.given).toBe(0);
    expect(claimDaily(first.wallet, '2026-10-27').given).toBe(0);
    const next = claimDaily(first.wallet, '2026-10-28');
    expect(next.given).toBe(DAILY_GIFT);
    expect(next.wallet.hints).toBe(STARTER_HINTS + DAILY_GIFT);
    expect(dayOf(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('gives star and world rewards once each', () => {
    const a = claimStars(newWallet(), '02-two-step');
    expect(a.given).toBe(1);
    expect(claimStars(a.wallet, '02-two-step').given).toBe(0);
    const b = claimWorld(a.wallet, 'Bars');
    expect(b.given).toBe(5);
    expect(claimWorld(b.wallet, 'Bars').given).toBe(0);
  });

  it('prices the full solution a little under hinting every step', () => {
    expect(solutionCost(5)).toBe(4);
    expect(solutionCost(1)).toBe(1);
    expect(PACKS.map((p) => p.hints)).toEqual([30, 80, 200]);
  });
});
