import { describe, expect, it } from 'vitest';
import { DEFAULT_SKIN, SKINS, parseSkin, shade, skinFill, spinAlong } from './skins';

describe('ball skins', () => {
  it('starts on the steel ball, and falls back to it for anything unknown', () => {
    expect(DEFAULT_SKIN.id).toBe('steel');
    expect(parseSkin(null).id).toBe('steel');
    expect(parseSkin('no-such-ball').id).toBe('steel');
    expect(parseSkin('gold').name).toBe('Gold');
  });

  it('has unique ids, names and proper colours', () => {
    expect(new Set(SKINS.map((s) => s.id)).size).toBe(SKINS.length);
    expect(new Set(SKINS.map((s) => s.name)).size).toBe(SKINS.length);
    for (const s of SKINS) if (s.fill) expect(s.fill).toMatch(/^#[0-9a-f]{6}$/);
    expect(skinFill(DEFAULT_SKIN, '#a7aeb3')).toBe('#a7aeb3');
  });

  it('shades colours lighter and darker', () => {
    expect(shade('#808080', 0)).toBe('#808080');
    expect(shade('#000000', 1)).toBe('#ffffff');
    expect(shade('#ffffff', -1)).toBe('#000000');
    expect(shade('#c4703a', 0.5)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('rolls with the travel: right turns it clockwise, left turns it back, a portal jump not at all', () => {
    const r = 8;
    expect(spinAlong([[0, 0], [8, 0], [16, 0]], r)).toEqual([0, 1, 2]);
    expect(spinAlong([[0, 0], [8, 0], [0, 0]], r)).toEqual([0, 1, 0]);
    expect(spinAlong([[0, 0], [200, 0]], r)).toEqual([0, 0]);
  });
});
