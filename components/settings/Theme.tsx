import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AUTO_THEME, THEMES, ThemeChoice } from '../../theme/colors';

// The board theme the player picked in Settings (theme/colors.ts THEMES, or Auto), remembered on the device. useColors() reads it.

export const THEME_KEY = 'bank-shot/theme';

const SetTheme = createContext<(id: string) => void>(() => {});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState(AUTO_THEME);
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((v) => { if (v && THEMES.some((t) => t.id === v)) setChoice(v); }).catch(() => {});
  }, []);
  const set = useCallback((id: string) => {
    const next = THEMES.some((t) => t.id === id) ? id : AUTO_THEME;
    setChoice(next);
    AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
  }, []);
  return (
    <ThemeChoice.Provider value={choice}>
      <SetTheme.Provider value={set}>{children}</SetTheme.Provider>
    </ThemeChoice.Provider>
  );
}

/** The player's choice ('auto' or a theme id) and how to change it. */
export function useThemeChoice(): [string, (id: string) => void] {
  return [useContext(ThemeChoice), useContext(SetTheme)];
}
