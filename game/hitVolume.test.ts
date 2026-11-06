import { describe, expect, it } from 'vitest';
import { hitVolume } from './hitVolume';

describe('bounce volume', () => {
  it('keeps even the softest bounce audible', () => {
    for (const k of ['wall', 'block', 'glass'] as const) expect(hitVolume(k, 0)).toBeGreaterThanOrEqual(0.4);
  });
  it('is louder for a harder hit, and never above full', () => {
    for (const k of ['wall', 'block', 'glass'] as const) {
      expect(hitVolume(k, 700)).toBeGreaterThan(hitVolume(k, 100));
      expect(hitVolume(k, 5000)).toBeLessThanOrEqual(1);
    }
  });
});
