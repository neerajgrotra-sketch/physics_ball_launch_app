import { describe, expect, it } from 'vitest';
import { DARK, LIGHT, THEMES, resolveTheme } from '../theme/palettes';

// Relative luminance and contrast ratio (WCAG), to keep every theme's pieces readable on its paper.
const lum = (hex: string) => {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

describe('board themes', () => {
  it('keeps graph paper and blueprint, and Auto follows the phone', () => {
    expect(resolveTheme('auto', false).palette).toBe(LIGHT);
    expect(resolveTheme('auto', true).palette).toBe(DARK);
    expect(resolveTheme('unknown', false).id).toBe('graph');
    expect(resolveTheme('chalk', false).id).toBe('chalk');
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
  });

  it('keeps walls, bars, the glass and text readable on every theme', () => {
    for (const t of THEMES) {
      const p = t.palette;
      expect(contrast(p.ink, p.paper), `${t.id} ink`).toBeGreaterThan(7);
      expect(contrast(p.pencil, p.paper), `${t.id} bars`).toBeGreaterThan(3.5);
      expect(contrast(p.red, p.paper), `${t.id} glass`).toBeGreaterThan(3);
      expect(contrast(p.muted, p.paper), `${t.id} muted text`).toBeGreaterThan(2.5);
      // The fixed gold of springs (always drawn with an ink outline) shows at least as well as on the original graph paper.
      expect(contrast('#ffb020', p.paper), `${t.id} springs`).toBeGreaterThanOrEqual(contrast('#ffb020', LIGHT.paper) - 0.01);
      expect(t.dark, `${t.id} dark flag`).toBe(lum(p.paper) < 0.2);
    }
  });
});
