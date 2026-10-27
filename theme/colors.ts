import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { AUTO_THEME, resolveTheme, type Palette, type Theme } from './palettes';

export { AUTO_THEME, DARK, LIGHT, THEMES, resolveTheme, type Palette, type Theme } from './palettes';

/** Font family names, as registered by useFonts in app/_layout.tsx. */
export const FONTS = {
  body: 'Barlow_400Regular',
  bodyMedium: 'Barlow_500Medium',
  bodySemi: 'Barlow_600SemiBold',
  condensed: 'BarlowCondensed_600SemiBold',
  condensedBold: 'BarlowCondensed_700Bold',
} as const;

/** The player's theme choice (components/settings/Theme.tsx provides it; 'auto' when nothing is chosen). */
export const ThemeChoice = createContext<string>(AUTO_THEME);

/** The current theme: the player's choice, or the phone's light or dark setting for Auto. */
export function useTheme(): Theme {
  return resolveTheme(useContext(ThemeChoice), useColorScheme() === 'dark');
}

/** The current palette (see useTheme). */
export function useColors(): Palette {
  return useTheme().palette;
}
