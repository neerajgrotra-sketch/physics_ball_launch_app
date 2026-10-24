import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { UNLOCKED_KEY, parseUnlocked, unlockAfterWin } from '../../game/progress';
import { BEST_KEY, better, parseBest, type Best, type BestByLevel } from '../../game/score';
import { LEVELS } from '../../levels';

interface Progress {
  /** Index of the furthest level the player can open. */
  unlocked: number;
  /** Each level's best unassisted result (stars, score, bounces). */
  best: BestByLevel;
  /** Record a win on level i, unlocking the next level and saving it. `result` is omitted for assisted wins. */
  won: (i: number, result?: Best) => void;
}

const ProgressContext = createContext<Progress>({ unlocked: 0, best: {}, won: () => {} });

/**
 * Keeps level unlocks and best results in AsyncStorage. Renders nothing until the saved values have
 * loaded, so screens never flash locked levels that are actually open. Storage errors fall back to
 * "first level only, no results".
 */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState<number | null>(null);
  const [best, setBest] = useState<BestByLevel>({});

  useEffect(() => {
    let live = true;
    Promise.all([
      AsyncStorage.getItem(UNLOCKED_KEY).catch(() => null),
      AsyncStorage.getItem(BEST_KEY).catch(() => null),
    ]).then(([u, b]) => {
      if (!live) return;
      setBest(parseBest(b));
      setUnlocked(parseUnlocked(u, LEVELS.length));
    });
    return () => { live = false; };
  }, []);

  const won = useCallback((i: number, result?: Best) => {
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
  }, []);

  if (unlocked === null) return null;
  return <ProgressContext.Provider value={{ unlocked, best, won }}>{children}</ProgressContext.Provider>;
}

export function useProgress(): Progress {
  return useContext(ProgressContext);
}
