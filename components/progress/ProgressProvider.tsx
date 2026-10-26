import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { TUTORIAL_ID } from '../../game/coach';
import { LOCK_LEVELS, UNLOCKED_KEY, parseUnlocked, unlockAfterWin } from '../../game/progress';
import { BEST_KEY, better, parseBest, type Best, type BestByLevel } from '../../game/score';
import { SHOTS_KEY, parseShots, type Shot, type ShotsByLevel } from '../../game/shots';
import { LEVELS } from '../../levels';

/** Marks that the saved unlock was worked out for the levels in worlds (0.18.0). */
const ORDER_KEY = 'bank-shot/order';
const ORDER_VERSION = 'worlds-1';

interface Progress {
  /** Index of the furthest level the player can open. */
  unlocked: number;
  /** Each level's best unassisted result (stars, score, bounces). */
  best: BestByLevel;
  /** Each level's last unassisted winning shot, drawn in the level list. */
  shots: ShotsByLevel;
  /**
   * Record a win on level i, unlocking the next level and saving it. `result` and `shot` are omitted
   * for assisted wins (a hint or Solve).
   */
  won: (i: number, result?: Best, shot?: Shot) => void;
}

const ProgressContext = createContext<Progress>({ unlocked: 0, best: {}, shots: {}, won: () => {} });

/**
 * Keeps level unlocks and best results in AsyncStorage. Renders nothing until the saved values have
 * loaded, so screens never flash locked levels that are actually open. Storage errors fall back to
 * "first level only, no results".
 */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState<number | null>(null);
  const [best, setBest] = useState<BestByLevel>({});
  const [shots, setShots] = useState<ShotsByLevel>({});

  useEffect(() => {
    let live = true;
    Promise.all([
      AsyncStorage.getItem(UNLOCKED_KEY).catch(() => null),
      AsyncStorage.getItem(BEST_KEY).catch(() => null),
      AsyncStorage.getItem(SHOTS_KEY).catch(() => null),
      AsyncStorage.getItem(ORDER_KEY).catch(() => null),
    ]).then(([u, b, s, order]) => {
      if (!live) return;
      // The tutorial doesn't score; drop any result an earlier version saved for it.
      const saved = parseBest(b);
      delete saved[TUTORIAL_ID];
      setBest(saved);
      setShots(parseShots(s));
      let open = parseUnlocked(u, LEVELS.length);
      if (order !== ORDER_VERSION) {
        // The levels were put in worlds (0.18.0): the saved "furthest level" counted the old order, so work it out again from the results.
        const won = LEVELS.map((l, i) => (saved[l.id] || parseShots(s)[l.id] ? i : -1));
        open = Math.min(LEVELS.length - 1, Math.max(-1, ...won) + 1);
        AsyncStorage.setItem(UNLOCKED_KEY, String(open)).catch(() => {});
        AsyncStorage.setItem(ORDER_KEY, ORDER_VERSION).catch(() => {});
      }
      setUnlocked(open);
    });
    return () => { live = false; };
  }, []);

  const won = useCallback((i: number, result?: Best, shot?: Shot) => {
    setUnlocked((u) => {
      const next = unlockAfterWin(u ?? 0, i, LEVELS.length);
      if (next !== u) AsyncStorage.setItem(UNLOCKED_KEY, String(next)).catch(() => {});
      return next;
    });
    if (result) setBest((all) => {
      const id = LEVELS[i].id, kept = better(all[id], result);
      if (kept === all[id]) return all;
      const next = { ...all, [id]: kept };
      AsyncStorage.setItem(BEST_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    if (shot) setShots((all) => {
      const next = { ...all, [LEVELS[i].id]: shot };
      AsyncStorage.setItem(SHOTS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  if (unlocked === null) return null;
  const open = LOCK_LEVELS ? unlocked : LEVELS.length - 1;
  return <ProgressContext.Provider value={{ unlocked: open, best, shots, won }}>{children}</ProgressContext.Provider>;
}

export function useProgress(): Progress {
  return useContext(ProgressContext);
}
