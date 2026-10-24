import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { TUTORIAL_ID } from '../../game/coach';
import { LOCK_LEVELS, UNLOCKED_KEY, parseUnlocked, unlockAfterWin } from '../../game/progress';
import { BEST_KEY, better, parseBest, type Best, type BestByLevel } from '../../game/score';
import { SHOTS_KEY, parseShots, type Shot, type ShotsByLevel } from '../../game/shots';
import { LEVELS } from '../../levels';

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
    ]).then(([u, b, s]) => {
      if (!live) return;
      // The tutorial doesn't score; drop any result an earlier version saved for it.
      const saved = parseBest(b);
      delete saved[TUTORIAL_ID];
      setBest(saved);
      setShots(parseShots(s));
      setUnlocked(parseUnlocked(u, LEVELS.length));
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
