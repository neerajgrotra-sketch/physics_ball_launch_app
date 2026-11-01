import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ASMR_KEY } from '../../game/asmr';
import { AUTO_THEME, NEON, THEMES, ThemeChoice } from '../../theme/colors';
import { feedbackPrefs } from '../feedback/SoundSettings';

// The board theme the player picked in Settings (theme/colors.ts THEMES, or Auto), remembered on the device. useColors() reads it.
// ASMR mode (game/asmr.ts) overrides it with the neon look while it's on, keeping the picked theme for when it's turned off.

export const THEME_KEY = 'bank-shot/theme';

const SetTheme = createContext<(id: string) => void>(() => {});
/** The theme the player picked, as opposed to the one showing (ThemeChoice), which ASMR mode replaces. */
const PickedTheme = createContext<string>(AUTO_THEME);
const Asmr = createContext<[boolean, (on: boolean) => void]>([false, () => {}]);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState(AUTO_THEME);
  const [asmr, setAsmrState] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((v) => { if (v && THEMES.some((t) => t.id === v)) setChoice(v); }).catch(() => {});
    AsyncStorage.getItem(ASMR_KEY).then((v) => { feedbackPrefs.asmr = v === '1'; setAsmrState(v === '1'); }).catch(() => {});
  }, []);
  const set = useCallback((id: string) => {
    const next = THEMES.some((t) => t.id === id) ? id : AUTO_THEME;
    setChoice(next);
    AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
  }, []);
  const setAsmr = useCallback((on: boolean) => {
    feedbackPrefs.asmr = on; // the sound code reads it as each bounce plays
    setAsmrState(on);
    AsyncStorage.setItem(ASMR_KEY, on ? '1' : '0').catch(() => {});
  }, []);
  return (
    <ThemeChoice.Provider value={asmr ? NEON.id : choice}>
      <PickedTheme.Provider value={choice}>
        <Asmr.Provider value={[asmr, setAsmr]}>
          <SetTheme.Provider value={set}>{children}</SetTheme.Provider>
        </Asmr.Provider>
      </PickedTheme.Provider>
    </ThemeChoice.Provider>
  );
}

/** The player's choice ('auto' or a theme id) and how to change it. */
export function useThemeChoice(): [string, (id: string) => void] {
  return [useContext(PickedTheme), useContext(SetTheme)];
}

/** ASMR mode (Settings): on or off, and how to change it. */
export function useAsmr(): [boolean, (on: boolean) => void] {
  return useContext(Asmr);
}
