import { describe, expect, it } from 'vitest';
import { parseShots, thin } from './shots';

describe('stored shots', () => {
  it('keeps good shots and drops bad ones', () => {
    const good = { pieces: [{ x: 1, y: 2, deg: 3, len: 90 }], angle: 40, power: 50 };
    expect(parseShots(JSON.stringify({ a: good, b: { pieces: [{ x: 'no' }], angle: 1, power: 2 }, c: null }))).toEqual({ a: good });
    expect(parseShots('not json')).toEqual({});
    expect(parseShots(null)).toEqual({});
  });

  it('thins a path, keeping the last point', () => {
    expect(thin([0, 1, 2, 3, 4, 5, 6], 3)).toEqual([0, 3, 6]);
    expect(thin([0, 1, 2, 3, 4], 3)).toEqual([0, 3, 4]);
    expect(thin([], 3)).toEqual([]);
  });
});
