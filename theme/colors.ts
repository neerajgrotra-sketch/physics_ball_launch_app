import { useColorScheme } from 'react-native';

// Colour tokens from reference/prototype.html: graph paper in light mode, blueprint in dark mode.
export const LIGHT = {
  paper: '#e9eee3', grid: '#cfdacb', ink: '#2c3133', pencil: '#2d5c9e', red: '#b5352a',
  muted: '#78837d', steel: '#a7aeb3', panel: '#dfe5d8', line: '#c3ccbe',
};

export const DARK: Palette = {
  paper: '#143562', grid: '#24497a', ink: '#e6edf6', pencil: '#9ccbff', red: '#ff8574',
  muted: '#8fa6c4', steel: '#c9d3de', panel: '#0f2b52', line: '#2a4f80',
};

export type Palette = typeof LIGHT;

/** Font family names, as registered by useFonts in app/_layout.tsx. */
export const FONTS = {
  body: 'Barlow_400Regular',
  bodyMedium: 'Barlow_500Medium',
  bodySemi: 'Barlow_600SemiBold',
  condensed: 'BarlowCondensed_600SemiBold',
  condensedBold: 'BarlowCondensed_700Bold',
} as const;

/** Follows the system appearance setting. */
export function useColors(): Palette {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}
