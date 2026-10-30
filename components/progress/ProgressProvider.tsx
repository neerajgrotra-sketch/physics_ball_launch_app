import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { DRAFTS_KEY, parseDrafts, type Draft, type DraftsByLevel } from '../../game/drafts';
import { TUTORIAL_ID } from '../../game/coach';
import { FRESH_KEY, FRESH_VERSION, LOCK_LEVELS, UNLOCK_ALL_KEY, UNLOCKED_KEY, parseUnlocked, unlockAfterWin } from '../../game/progress';
import { BEST_KEY, better, parseBest, type Best, type BestByLevel } from '../../game/score';
import { SHOTS_KEY, parseShots, type Shot, type ShotsByLevel } from '../../game/shots';
import { LEVELS } from '../../levels';
import { TIPS_KEY, useTips } from '../coach/Tips';

/** Marks that the saved unlock was worked out for the levels in worlds (0.18.0). */
const ORDER_KEY = 'bank-shot/order';
const ORDER_VERSION = 'worlds-1';

interface Progress {
  /** Index of the furthest level the player can open (every level while the Testing switch is on). */
  unlocked: number;
  /** Index of the furthest level the player has unlocked by playing, whatever the Testing switch says. */
  frontier: number;
  /** Each level's best unassisted result (stars, score, bounces). */
  best: BestByLevel;
  /** Each level's last unassisted winning shot, drawn in the level list. */
  shots: ShotsByLevel;
  /**
   * Record a win on level i, unlocking the next level and saving it. `result` and `shot` are omitted
   * for assisted wins (a hint or Solve).
   */
  won: (i: number, result?: Best, shot?: Shot) => void;
  /** Testing only (settings): open every level whatever the player has won. Remembered. */
  unlockAll: boolean;
  setUnlockAll: (on: boolean) => void;
  /** Testing only (settings): forget every win, star and saved shot, and lock everything but level 1 again. */
  resetProgress: () => void;
  /** A level left part-way (game/drafts.ts), keyed by level id or `daily-N`: read when it opens, so the player picks up where they were. */
  draftFor: (key: string) => Draft | undefined;
  /** Save (or with null, forget) a level's draft. Kept in memory at once and written to storage shortly after. */
  saveDraft: (key: string, draft: Draft | null) => void;
}

const ProgressContext = createContext<Progress>({
  unlocked: 0, frontier: 0, best: {}, shots: {}, won: () => {}, unlockAll: false, setUnlockAll: () => {}, resetProgress: () => {},
  draftFor: () => undefined, saveDraft: () => {},
});

const PROGRESS_KEYS = [UNLOCKED_KEY, BEST_KEY, SHOTS_KEY, ORDER_KEY, DRAFTS_KEY];

/**
 * Keeps level unlocks and best results in AsyncStorage. Renders nothing until the saved values have
 * loaded, so screens never flash locked levels that are actually open. Storage errors fall back to
 * "first level only, no results".
 */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState<number | null>(null);
  const [best, setBest] = useState<BestByLevel>({});
  const [shots, setShots] = useState<ShotsByLevel>({});
  const [unlockAll, setUnlockAllState] = useState(false);
  // Drafts change on every drag, so they live in a ref (no re-render of the app) and are written at most every 400 ms.
  const drafts = useRef<DraftsByLevel>({});
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      // Locks came on (FRESH_VERSION): every device starts again from level 1 and the tutorial, once. The tips are reset here too,
      // before the tips provider (a child of this one) reads them.
      const fresh = await AsyncStorage.getItem(FRESH_KEY).catch(() => null);
      if (fresh !== FRESH_VERSION) {
        await AsyncStorage.multiRemove([...PROGRESS_KEYS, TIPS_KEY, UNLOCK_ALL_KEY]).catch(() => {});
        await AsyncStorage.setItem(ORDER_KEY, ORDER_VERSION).catch(() => {});
        await AsyncStorage.setItem(FRESH_KEY, FRESH_VERSION).catch(() => {});
      }
      const [u, b, s, order, all] = await Promise.all([
        AsyncStorage.getItem(UNLOCKED_KEY).catch(() => null),
        AsyncStorage.getItem(BEST_KEY).catch(() => null),
        AsyncStorage.getItem(SHOTS_KEY).catch(() => null),
        AsyncStorage.getItem(ORDER_KEY).catch(() => null),
        AsyncStorage.getItem(UNLOCK_ALL_KEY).catch(() => null),
      ]);
      drafts.current = parseDrafts(await AsyncStorage.getItem(DRAFTS_KEY).catch(() => null));
      if (!live) return;
      // The tutorial doesn't score; drop any result an earlier version saved for it.
      const saved = parseBest(b);
      delete saved[TUTORIAL_ID];
      setBest(saved);
      setShots(parseShots(s));
      setUnlockAllState(all === '1');
      let open = parseUnlocked(u, LEVELS.length);
      if (order !== ORDER_VERSION) {
        // The levels were put in worlds (0.18.0): the saved "furthest level" counted the old order, so work it out again from the results.
        const won = LEVELS.map((l, i) => (saved[l.id] || parseShots(s)[l.id] ? i : -1));
        open = Math.min(LEVELS.length - 1, Math.max(-1, ...won) + 1);
        AsyncStorage.setItem(UNLOCKED_KEY, String(open)).catch(() => {});
        AsyncStorage.setItem(ORDER_KEY, ORDER_VERSION).catch(() => {});
      }
      setUnlocked(open);
    })();
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

  const setUnlockAll = useCallback((on: boolean) => {
    setUnlockAllState(on);
    AsyncStorage.setItem(UNLOCK_ALL_KEY, on ? '1' : '0').catch(() => {});
  }, []);

  const draftFor = useCallback((key: string) => drafts.current[key], []);
  const saveDraft = useCallback((key: string, draft: Draft | null) => {
    if (!draft && !drafts.current[key]) return;
    const next = { ...drafts.current };
    if (draft) next[key] = draft;
    else delete next[key];
    drafts.current = next;
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      writeTimer.current = null;
      AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts.current)).catch(() => {});
    }, 400);
  }, []);

  const resetProgress = useCallback(() => {
    if (writeTimer.current) clearTimeout(writeTimer.current);
    drafts.current = {};
    AsyncStorage.multiRemove([UNLOCKED_KEY, BEST_KEY, SHOTS_KEY, DRAFTS_KEY]).catch(() => {});
    setUnlocked(0);
    setBest({});
    setShots({});
  }, []);

  if (unlocked === null) return null;
  const open = LOCK_LEVELS && !unlockAll ? unlocked : LEVELS.length - 1;
  return (
    <ProgressContext.Provider value={{ unlocked: open, frontier: unlocked, best, shots, won, unlockAll, setUnlockAll, resetProgress, draftFor, saveDraft }}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress(): Progress {
  return useContext(ProgressContext);
}

/**
 * The furthest level the player can open: what they have won, and level 2 once the tutorial is finished or skipped (skipping it must not
 * leave a new player stuck on level 1).
 */
export function useUnlocked(): number {
  const { unlocked } = useProgress();
  const { tutorialDone } = useTips();
  return Math.max(unlocked, tutorialDone ? Math.min(1, LEVELS.length - 1) : 0);
}
