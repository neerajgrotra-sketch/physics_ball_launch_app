import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { UNLOCKED_KEY, parseUnlocked, unlockAfterWin } from '../../game/progress';
import { LEVELS } from '../../levels';

interface Progress {
  /** Index of the furthest level the player can open. */
  unlocked: number;
  /** Record a win on level i, unlocking the next level and saving it. */
  won: (i: number) => void;
}

const ProgressContext = createContext<Progress>({ unlocked: 0, won: () => {} });

/**
 * Keeps level unlocks in AsyncStorage. Renders nothing until the saved value has loaded, so screens
 * never flash locked levels that are actually open. Storage errors fall back to "first level only".
 */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(UNLOCKED_KEY)
      .catch(() => null)
      .then((raw) => live && setUnlocked(parseUnlocked(raw, LEVELS.length)));
    return () => { live = false; };
  }, []);

  const won = useCallback((i: number) => {
    setUnlocked((u) => {
      const next = unlockAfterWin(u ?? 0, i, LEVELS.length);
      if (next !== u) AsyncStorage.setItem(UNLOCKED_KEY, String(next)).catch(() => {});
      return next;
    });
  }, []);

  if (unlocked === null) return null;
  return <ProgressContext.Provider value={{ unlocked, won }}>{children}</ProgressContext.Provider>;
}

export function useProgress(): Progress {
  return useContext(ProgressContext);
}
