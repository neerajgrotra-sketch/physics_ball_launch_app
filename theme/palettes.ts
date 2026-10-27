// Pure colour data (no React), so tests can check every theme. theme/colors.ts adds the hooks.

// Colour tokens from reference/prototype.html: graph paper in light mode, blueprint in dark mode. More board themes below.
export const LIGHT = {
  paper: '#e9eee3', grid: '#cfdacb', ink: '#2c3133', pencil: '#2d5c9e', red: '#b5352a',
  muted: '#78837d', steel: '#a7aeb3', panel: '#dfe5d8', line: '#c3ccbe',
};

export const DARK: Palette = {
  paper: '#143562', grid: '#24497a', ink: '#e6edf6', pencil: '#9ccbff', red: '#ff8574',
  muted: '#8fa6c4', steel: '#c9d3de', panel: '#0f2b52', line: '#2a4f80',
};

export type Palette = typeof LIGHT;


/**
 * Board themes the player can pick in Settings (components/settings/ThemePicker.tsx). Each is a whole palette, so the board, the
 * buttons and the cards all change together. Every one keeps the pieces readable: bars in `pencil`, the glass and spikes in `red`,
 * walls in `ink`, and the fixed gold of springs and blue/orange of portals. 'auto' (the default) is graph paper or blueprint,
 * following the phone's light or dark setting.
 */
export interface Theme { id: string; name: string; palette: Palette; dark: boolean }

export const THEMES: Theme[] = [
  { id: 'graph', name: 'Graph paper', palette: LIGHT, dark: false },
  { id: 'blueprint', name: 'Blueprint', palette: DARK, dark: true },
  {
    id: 'chalk', name: 'Chalkboard', dark: true, palette: {
      paper: '#1f3a2e', grid: '#2e5141', ink: '#eef2ea', pencil: '#f3dd6d', red: '#ff8a78',
      muted: '#9fb8a9', steel: '#d6dad3', panel: '#172d23', line: '#3b6351',
    },
  },
  {
    id: 'notebook', name: 'Notebook', dark: false, palette: {
      paper: '#fbfbf6', grid: '#d2def3', ink: '#2a2f36', pencil: '#2b57c0', red: '#d0373a',
      muted: '#7b8694', steel: '#a6aeb7', panel: '#eff0ea', line: '#d3d9e2',
    },
  },
  {
    id: 'night', name: 'Night', dark: true, palette: {
      paper: '#0c0f16', grid: '#1c2333', ink: '#e8ecf5', pencil: '#4fdcff', red: '#ff5a92',
      muted: '#808aa0', steel: '#c3c9d6', panel: '#07090e', line: '#283044',
    },
  },
  {
    id: 'sand', name: 'Sand', dark: false, palette: {
      paper: '#f6eedd', grid: '#e3d4b5', ink: '#3b3226', pencil: '#2a6b70', red: '#bf432a',
      muted: '#8a7a62', steel: '#a59c90', panel: '#e9dcc2', line: '#d5c3a0',
    },
  },
];

export const AUTO_THEME = 'auto';

/** The palette for a theme choice: 'auto' (or anything unknown) follows the phone's light or dark setting. */
export function resolveTheme(id: string, systemDark: boolean): Theme {
  return THEMES.find((t) => t.id === id) ?? (systemDark ? THEMES[1] : THEMES[0]);
}
