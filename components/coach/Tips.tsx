import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export const TIPS_KEY = 'bank-shot/tips';

interface Tips {
  /** Whether the ghost finger may appear at all. On unless the player stopped it. */
  tipsOn: boolean;
  /** Turning tips back on also brings the tutorial back. */
  setTipsOn: (on: boolean) => void;
  /** The level 1 tutorial has been finished or skipped. */
  tutorialDone: boolean;
  finishTutorial: () => void;
  /** Tips on and the tutorial pending again (the ⚙ sheet's "Replay tutorial"). */
  restartTutorial: () => void;
}

const TipsContext = createContext<Tips>({
  tipsOn: true, setTipsOn: () => {}, tutorialDone: false, finishTutorial: () => {}, restartTutorial: () => {},
});

interface State { off: boolean; tutorialDone: boolean }

/** Keeps the tips setting and tutorial progress on the device. Storage trouble just means defaults. */
export function TipsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ off: false, tutorialDone: false });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(TIPS_KEY).then((raw) => {
      try {
        const o = JSON.parse(raw ?? '{}');
        setState((s) => ({ off: o.off === true || s.off, tutorialDone: o.tutorialDone === true || s.tutorialDone }));
      } catch { /* defaults */ }
    }).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  const save = (next: State) => { AsyncStorage.setItem(TIPS_KEY, JSON.stringify(next)).catch(() => {}); return next; };
  const setTipsOn = useCallback((on: boolean) => setState((s) => save(on ? { off: false, tutorialDone: false } : { ...s, off: true })), []);
  const finishTutorial = useCallback(() => setState((s) => (s.tutorialDone ? s : save({ ...s, tutorialDone: true }))), []);
  const restartTutorial = useCallback(() => setState(() => save({ off: false, tutorialDone: false })), []);

  // Like the progress, nothing shows until what's saved has loaded, so a returning player never sees the
  // tutorial for a moment.
  if (!loaded) return null;
  return (
    <TipsContext.Provider value={{ tipsOn: !state.off, setTipsOn, tutorialDone: state.tutorialDone, finishTutorial, restartTutorial }}>
      {children}
    </TipsContext.Provider>
  );
}

export function useTips(): Tips {
  return useContext(TipsContext);
}
